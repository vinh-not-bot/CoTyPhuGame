-- ============================================================================
-- Migration: 20260702100000_upgrade.sql
-- Mô tả: Thêm hỗ trợ phòng công khai/riêng tư, chọn nhân vật, và ghép trận nhanh
-- ============================================================================

-- ============================================================================
-- 1. THÊM CỘT MỚI CHO BẢNG rooms VÀ room_players
-- ============================================================================

-- Thêm cột is_public để phân biệt phòng công khai và riêng tư
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Thêm cột character_id để lưu nhân vật đã chọn của người chơi
ALTER TABLE room_players
  ADD COLUMN IF NOT EXISTS character_id VARCHAR(30) DEFAULT 'default';

-- ============================================================================
-- 2. SỬA HÀM create_room - Khắc phục lỗi "column reference room_code is ambiguous"
--    Thêm tham số p_is_public, dùng alias r. để phân biệt cột bảng và biến
-- ============================================================================

-- Xóa hàm cũ vì chữ ký thay đổi (thêm p_is_public)
DROP FUNCTION IF EXISTS create_room(UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION create_room(
  p_host_user_id UUID,
  p_host_name TEXT,
  p_settings JSONB,
  p_is_public BOOLEAN DEFAULT false
) RETURNS TABLE (
  room_id UUID,
  room_code VARCHAR(6)
) AS $$
DECLARE
  v_room_code VARCHAR(6);
  v_room_id UUID;
BEGIN
  -- Tạo mã phòng ngẫu nhiên 6 ký tự, đảm bảo không trùng
  -- Sử dụng alias r. để tránh nhập nhằng giữa biến v_room_code và cột rooms.room_code
  LOOP
    v_room_code := upper(substring(md5(random()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM rooms r WHERE r.room_code = v_room_code
    );
  END LOOP;

  -- Chèn phòng mới với trạng thái công khai/riêng tư
  INSERT INTO rooms (room_code, host_id, status, settings, is_public)
  VALUES (v_room_code, p_host_user_id, 'WAITING', p_settings, p_is_public)
  RETURNING id INTO v_room_id;

  -- Chèn người chơi đầu tiên làm Host (chủ phòng)
  INSERT INTO room_players (room_id, user_id, display_name, turn_order, is_host)
  VALUES (v_room_id, p_host_user_id, p_host_name, 0, true);

  RETURN QUERY SELECT v_room_id, v_room_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. SỬA HÀM join_room - Thêm tham số p_character_id để lưu nhân vật
-- ============================================================================

-- Xóa hàm cũ vì chữ ký thay đổi (thêm p_character_id)
DROP FUNCTION IF EXISTS join_room(TEXT, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION join_room(
  p_room_code TEXT,
  p_user_id UUID,
  p_display_name TEXT,
  p_avatar_color TEXT,
  p_character_id TEXT DEFAULT 'default'
) RETURNS UUID AS $$
DECLARE
  v_room_id UUID;
  v_status VARCHAR(20);
  v_max_players INT;
  v_current_players INT;
  v_turn_order INT;
BEGIN
  -- Lấy thông tin phòng, dùng alias r. để tránh nhập nhằng
  SELECT r.id, r.status, (r.settings->>'maxPlayers')::int
  INTO v_room_id, v_status, v_max_players
  FROM rooms r
  WHERE upper(r.room_code) = upper(p_room_code);

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Phòng không tồn tại';
  END IF;

  IF v_status != 'WAITING' THEN
    RAISE EXCEPTION 'Phòng không còn ở trạng thái chờ';
  END IF;

  -- Kiểm tra xem người chơi đã trong phòng chưa
  SELECT rp.turn_order INTO v_turn_order
  FROM room_players rp
  WHERE rp.room_id = v_room_id AND rp.user_id = p_user_id;

  IF v_turn_order IS NOT NULL THEN
    -- Đã ở trong phòng, chỉ cập nhật tên, màu đại diện và nhân vật
    UPDATE room_players rp
    SET display_name = p_display_name,
        avatar_color = p_avatar_color,
        character_id = p_character_id
    WHERE rp.room_id = v_room_id AND rp.user_id = p_user_id;
    RETURN v_room_id;
  END IF;

  -- Kiểm tra số lượng người chơi hiện tại
  SELECT count(*)::int INTO v_current_players
  FROM room_players rp
  WHERE rp.room_id = v_room_id;

  IF v_current_players >= v_max_players THEN
    RAISE EXCEPTION 'Phòng đã đầy';
  END IF;

  -- Thêm người chơi mới với nhân vật đã chọn
  INSERT INTO room_players (room_id, user_id, display_name, avatar_color, turn_order, is_host, character_id)
  VALUES (v_room_id, p_user_id, p_display_name, p_avatar_color, v_current_players, false, p_character_id);

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. TẠO HÀM quick_join - Ghép trận nhanh vào phòng công khai
-- ============================================================================

CREATE OR REPLACE FUNCTION quick_join(
  p_user_id UUID,
  p_display_name TEXT,
  p_avatar_color TEXT,
  p_character_id TEXT DEFAULT 'default'
) RETURNS TABLE (
  room_id UUID,
  room_code VARCHAR(6)
) AS $$
DECLARE
  v_room_id UUID;
  v_room_code VARCHAR(6);
  v_max_players INT;
  v_current_players INT;
  v_turn_order INT;
BEGIN
  -- Tìm phòng công khai đang chờ và còn chỗ trống
  -- Ưu tiên phòng có nhiều người chơi nhất (sắp đầy) để bắt đầu nhanh hơn
  SELECT r.id, r.room_code, (r.settings->>'maxPlayers')::int
  INTO v_room_id, v_room_code, v_max_players
  FROM rooms r
  WHERE r.is_public = true
    AND r.status = 'WAITING'
    AND (
      SELECT count(*)::int FROM room_players rp WHERE rp.room_id = r.id
    ) < (r.settings->>'maxPlayers')::int
  ORDER BY (
    SELECT count(*) FROM room_players rp WHERE rp.room_id = r.id
  ) DESC
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    -- Tìm thấy phòng công khai còn chỗ, thêm người chơi vào

    -- Kiểm tra xem người chơi đã trong phòng này chưa
    SELECT rp.turn_order INTO v_turn_order
    FROM room_players rp
    WHERE rp.room_id = v_room_id AND rp.user_id = p_user_id;

    IF v_turn_order IS NOT NULL THEN
      -- Đã trong phòng, cập nhật thông tin
      UPDATE room_players rp
      SET display_name = p_display_name,
          avatar_color = p_avatar_color,
          character_id = p_character_id
      WHERE rp.room_id = v_room_id AND rp.user_id = p_user_id;
    ELSE
      -- Đếm số người chơi hiện tại để xác định turn_order
      SELECT count(*)::int INTO v_current_players
      FROM room_players rp
      WHERE rp.room_id = v_room_id;

      -- Thêm người chơi mới
      INSERT INTO room_players (room_id, user_id, display_name, avatar_color, turn_order, is_host, character_id)
      VALUES (v_room_id, p_user_id, p_display_name, p_avatar_color, v_current_players, false, p_character_id);
    END IF;

    RETURN QUERY SELECT v_room_id, v_room_code;
  ELSE
    -- Không tìm thấy phòng công khai phù hợp, tạo phòng mới
    -- Cài đặt mặc định: 4 người chơi tối đa, 1500 tiền khởi đầu
    RETURN QUERY SELECT *
    FROM create_room(
      p_host_user_id := p_user_id,
      p_host_name := p_display_name,
      p_settings := '{"maxPlayers": 4, "startMoney": 1500}'::jsonb,
      p_is_public := true
    );

    -- Cập nhật nhân vật và màu đại diện cho host vừa tạo
    -- (create_room không truyền avatar_color và character_id)
    UPDATE room_players rp
    SET avatar_color = p_avatar_color,
        character_id = p_character_id
    WHERE rp.user_id = p_user_id
      AND rp.room_id = (
        SELECT r.id FROM rooms r
        WHERE r.host_id = p_user_id
        ORDER BY r.created_at DESC
        LIMIT 1
      );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. CẬP NHẬT HÀM start_game - Thêm characterId vào JSONB người chơi
-- ============================================================================

CREATE OR REPLACE FUNCTION start_game(
  p_room_id UUID
) RETURNS VOID AS $$
DECLARE
  v_player_count INT;
  v_players_json JSONB;
  v_board_json JSONB;
  v_chance_json JSONB;
  v_community_json JSONB;
  v_start_money INT;
BEGIN
  -- Lấy tiền bắt đầu từ cấu hình phòng
  SELECT ((r.settings->>'startMoney')::int) INTO v_start_money
  FROM rooms r WHERE r.id = p_room_id;
  IF v_start_money IS NULL THEN
    v_start_money := 1500;
  END IF;

  -- Kiểm tra số lượng người chơi
  SELECT count(*) INTO v_player_count
  FROM room_players rp WHERE rp.room_id = p_room_id;
  IF v_player_count < 2 THEN
    RAISE EXCEPTION 'Trò chơi cần ít nhất 2 người chơi';
  END IF;

  -- Tạo danh sách người chơi dưới dạng JSONB, bao gồm characterId
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', rp.user_id,
      'name', rp.display_name,
      'avatarColor', rp.avatar_color,
      'characterId', rp.character_id,
      'cash', v_start_money,
      'position', 0,
      'inJail', false,
      'jailTurns', 0,
      'isBankrupt', false,
      'doubleRollCount', 0
    ) ORDER BY rp.turn_order
  ) INTO v_players_json
  FROM room_players rp
  WHERE rp.room_id = p_room_id;

  -- Thiết lập Board 40 ô chuẩn
  v_board_json := '[
    {"index": 0, "name": "Cổng Khởi Hành (GO)", "type": "go", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 1, "name": "Đường Bình Giã", "type": "property", "price": 60, "rent": [2, 10, 30, 90, 160, 250], "housePrice": 50, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "brown"},
    {"index": 2, "name": "Khí Vận (Community Chest)", "type": "communitychest", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 3, "name": "Đường Trường Chinh", "type": "property", "price": 60, "rent": [4, 20, 60, 180, 320, 450], "housePrice": 50, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "brown"},
    {"index": 4, "name": "Thuế Thu Nhập", "type": "tax", "price": 200, "rent": [200], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 5, "name": "Ga Sài Gòn", "type": "railroad", "price": 200, "rent": [25, 50, 100, 200], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 6, "name": "Đường Lê Lợi", "type": "property", "price": 100, "rent": [6, 30, 90, 270, 400, 550], "housePrice": 50, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "sky"},
    {"index": 7, "name": "Cơ Hội (Chance)", "type": "chance", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 8, "name": "Đường Huỳnh Thúc Kháng", "type": "property", "price": 100, "rent": [6, 30, 90, 270, 400, 550], "housePrice": 50, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "sky"},
    {"index": 9, "name": "Đường Nguyễn Trung Trực", "type": "property", "price": 120, "rent": [8, 40, 100, 300, 450, 600], "housePrice": 50, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "sky"},
    {"index": 10, "name": "Nhà Tù (Jail)", "type": "jail", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 11, "name": "Đường Trần Hưng Đạo", "type": "property", "price": 140, "rent": [10, 50, 150, 450, 625, 750], "housePrice": 100, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "pink"},
    {"index": 12, "name": "Công Ty Điện Lực", "type": "utility", "price": 150, "rent": [4, 10], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 13, "name": "Đường Lê Hồng Phong", "type": "property", "price": 140, "rent": [10, 50, 150, 450, 625, 750], "housePrice": 100, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "pink"},
    {"index": 14, "name": "Đường Nguyễn Thị Minh Khai", "type": "property", "price": 160, "rent": [12, 60, 180, 500, 700, 900], "housePrice": 100, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "pink"},
    {"index": 15, "name": "Ga Hà Nội", "type": "railroad", "price": 200, "rent": [25, 50, 100, 200], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 16, "name": "Đường Bà Triệu", "type": "property", "price": 180, "rent": [14, 70, 200, 550, 750, 950], "housePrice": 100, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "orange"},
    {"index": 17, "name": "Khí Vận (Community Chest)", "type": "communitychest", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 18, "name": "Đường Tây Sơn", "type": "property", "price": 180, "rent": [14, 70, 200, 550, 750, 950], "housePrice": 100, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "orange"},
    {"index": 19, "name": "Đường Hàng Bạc", "type": "property", "price": 200, "rent": [16, 80, 220, 600, 800, 1000], "housePrice": 100, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "orange"},
    {"index": 20, "name": "Bãi Đỗ Xe Miễn Phí", "type": "freeparking", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 21, "name": "Đường Điện Biên Phủ", "type": "property", "price": 220, "rent": [18, 90, 250, 700, 875, 1050], "housePrice": 150, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "red"},
    {"index": 22, "name": "Cơ Hội (Chance)", "type": "chance", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 23, "name": "Đường Hai Bà Trưng", "type": "property", "price": 220, "rent": [18, 90, 250, 700, 875, 1050], "housePrice": 150, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "red"},
    {"index": 24, "name": "Đường Nguyễn Trãi", "type": "property", "price": 240, "rent": [20, 100, 300, 750, 925, 1100], "housePrice": 150, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "red"},
    {"index": 25, "name": "Ga Đà Nẵng", "type": "railroad", "price": 200, "rent": [25, 50, 100, 200], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 26, "name": "Đường Lê Duẩn", "type": "property", "price": 260, "rent": [22, 110, 330, 800, 975, 1150], "housePrice": 150, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "yellow"},
    {"index": 27, "name": "Đường Tôn Đức Thắng", "type": "property", "price": 260, "rent": [22, 110, 330, 800, 975, 1150], "housePrice": 150, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "yellow"},
    {"index": 28, "name": "Nhà Máy Nước", "type": "utility", "price": 150, "rent": [4, 10], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 29, "name": "Đường Đống Đa", "type": "property", "price": 280, "rent": [24, 120, 360, 850, 1025, 1200], "housePrice": 150, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "yellow"},
    {"index": 30, "name": "Vào Tù (Go To Jail)", "type": "gotojail", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 31, "name": "Đường Nguyễn Chí Thanh", "type": "property", "price": 300, "rent": [26, 130, 390, 900, 1100, 1275], "housePrice": 200, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "green"},
    {"index": 32, "name": "Đường Kim Mã", "type": "property", "price": 300, "rent": [26, 130, 390, 900, 1100, 1275], "housePrice": 200, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "green"},
    {"index": 33, "name": "Khí Vận (Community Chest)", "type": "communitychest", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 34, "name": "Đường Giảng Võ", "type": "property", "price": 320, "rent": [28, 150, 450, 1000, 1200, 1400], "housePrice": 200, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "green"},
    {"index": 35, "name": "Ga Huế", "type": "railroad", "price": 200, "rent": [25, 50, 100, 200], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 36, "name": "Cơ Hội (Chance)", "type": "chance", "price": 0, "rent": [0], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 37, "name": "Đường Nguyễn Huệ", "type": "property", "price": 350, "rent": [35, 175, 500, 1100, 1300, 1500], "housePrice": 200, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "navy"},
    {"index": 38, "name": "Thuế Xa Xỉ", "type": "tax", "price": 100, "rent": [100], "housePrice": 0, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": null},
    {"index": 39, "name": "Đường Đồng Khởi", "type": "property", "price": 400, "rent": [50, 200, 600, 1400, 1700, 2000], "housePrice": 200, "houses": 0, "ownerId": null, "mortgaged": false, "colorGroup": "navy"}
  ]';

  -- Tạo bộ thẻ Cơ Hội ngẫu nhiên
  v_chance_json := '[
    {"id": 1, "text": "Ngân hàng chia cổ tức, nhận 50", "type": "money", "value": 50},
    {"id": 2, "text": "Bị phạt vì đậu xe sai quy định, đóng 50", "type": "money", "value": -50},
    {"id": 3, "text": "Đi thẳng đến Ô Khởi Hành (GO) và nhận 200", "type": "move_to", "value": 0},
    {"id": 4, "text": "Bị bắt đi tù vì trốn thuế", "type": "go_to_jail"},
    {"id": 5, "text": "Thẻ thoát tù miễn phí", "type": "jail_free"},
    {"id": 6, "text": "Lùi lại 3 ô", "type": "move_steps", "value": -3},
    {"id": 7, "text": "Trúng xổ số cờ tỷ phú, nhận 100", "type": "money", "value": 100},
    {"id": 8, "text": "Hỗ trợ y tế tuyến đầu, đóng đóng 100", "type": "money", "value": -100},
    {"id": 9, "text": "Ngân hàng thanh lý tài sản, nhận 150", "type": "money", "value": 150},
    {"id": 10, "text": "Đóng phí bảo hiểm ô tô điện, trả 50", "type": "money", "value": -50},
    {"id": 11, "text": "Đi du lịch bằng đường sắt tới Ga Sài Gòn (ô số 5)", "type": "move_to", "value": 5},
    {"id": 12, "text": "Sinh nhật bạn! Mỗi người chơi tặng bạn 10", "type": "birthday", "value": 10},
    {"id": 13, "text": "Phí nâng cấp sửa chữa đường phố, trả 150", "type": "money", "value": -150},
    {"id": 14, "text": "Thu hoạch mùa màng tốt, nhận 100", "type": "money", "value": 100},
    {"id": 15, "text": "Cơ quan thuế kiểm toán tài chính cá nhân, đóng 150", "type": "money", "value": -150},
    {"id": 16, "text": "Vượt đèn đỏ phạt nóng, đóng 50", "type": "money", "value": -50}
  ]';

  -- Tạo bộ thẻ Khí Vận ngẫu nhiên
  v_community_json := '[
    {"id": 1, "text": "Nhận tiền thừa kế từ họ hàng, nhận 100", "type": "money", "value": 100},
    {"id": 2, "text": "Tiền bảo hiểm nhân thọ đáo hạn, nhận 100", "type": "money", "value": 100},
    {"id": 3, "text": "Đóng thuế sức khỏe định kỳ, trả 100", "type": "money", "value": -100},
    {"id": 4, "text": "Quỹ lớp đóng góp hoạt động từ thiện, nhận 25", "type": "money", "value": 25},
    {"id": 5, "text": "Đi thẳng đến Nhà Tù", "type": "go_to_jail"},
    {"id": 6, "text": "Thẻ thoát tù miễn phí từ Khí Vận", "type": "jail_free"},
    {"id": 7, "text": "Nhận lãi suất tiết kiệm ngân hàng, nhận 20", "type": "money", "value": 20},
    {"id": 8, "text": "Hoàn trả thuế cá nhân thành công, nhận 15", "type": "money", "value": 15},
    {"id": 9, "text": "Tiệc sinh nhật! Mỗi người chúc mừng tặng bạn 10", "type": "birthday", "value": 10},
    {"id": 10, "text": "Bán đấu giá đồ cũ trong nhà, nhận 25", "type": "money", "value": 25},
    {"id": 11, "text": "Thanh toán viện phí bảo hiểm y tế, đóng 100", "type": "money", "value": -100},
    {"id": 12, "text": "Trúng giải nhất xổ số điện toán Vietlott, nhận 200", "type": "money", "value": 200},
    {"id": 13, "text": "Đóng phí đăng kiểm ô tô định kỳ, trả 50", "type": "money", "value": -50},
    {"id": 14, "text": "Thanh toán hóa đơn tiền điện sản xuất, trả 50", "type": "money", "value": -50},
    {"id": 15, "text": "Nhận tiền tài trợ nghiên cứu khoa học từ quỹ xã hội, nhận 100", "type": "money", "value": 100},
    {"id": 16, "text": "Dạo bước về Ô Khởi Hành (GO) và nhận 200", "type": "move_to", "value": 0}
  ]';

  -- Cập nhật trạng thái phòng thành đang chơi
  UPDATE rooms SET status = 'PLAYING' WHERE id = p_room_id;

  -- Tạo hoặc cập nhật game_state
  INSERT INTO game_states (
    room_id,
    current_turn_index,
    turn_phase,
    players,
    board,
    chance_deck,
    community_deck,
    last_dice,
    log,
    winner_id
  ) VALUES (
    p_room_id,
    0,
    'roll',
    v_players_json,
    v_board_json,
    v_chance_json,
    v_community_json,
    '[1, 1]'::jsonb,
    '[]'::jsonb || jsonb_build_object('time', now(), 'text', 'Trò chơi bắt đầu!'),
    NULL
  )
  ON CONFLICT (room_id) DO UPDATE SET
    current_turn_index = 0,
    turn_phase = 'roll',
    players = v_players_json,
    board = v_board_json,
    chance_deck = v_chance_json,
    community_deck = v_community_json,
    last_dice = '[1, 1]'::jsonb,
    log = '[]'::jsonb || jsonb_build_object('time', now(), 'text', 'Trò chơi bắt đầu!'),
    winner_id = NULL,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
