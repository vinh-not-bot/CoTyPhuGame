-- Bảng rooms
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'WAITING', -- WAITING, PLAYING, FINISHED
  settings JSONB NOT NULL DEFAULT '{"startMoney": 1500, "maxPlayers": 4, "freeParkingJackpot": false}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng room_players
CREATE TABLE IF NOT EXISTS room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  avatar_color VARCHAR(20) DEFAULT '#3b82f6',
  turn_order INT,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Bảng game_states
CREATE TABLE IF NOT EXISTS game_states (
  room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  current_turn_index INT DEFAULT 0,
  turn_phase VARCHAR(20) DEFAULT 'roll', -- roll, resolve, action, end
  players JSONB NOT NULL DEFAULT '[]', -- Array of: {userId, name, cash, position, inJail, jailTurns, isBankrupt, doubleRollCount}
  board JSONB NOT NULL DEFAULT '[]', -- Array of 40 tiles
  chance_deck JSONB NOT NULL DEFAULT '[]',
  community_deck JSONB NOT NULL DEFAULT '[]',
  last_dice JSONB NOT NULL DEFAULT '[1, 1]',
  log JSONB NOT NULL DEFAULT '[]',
  winner_id UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng game_actions
CREATE TABLE IF NOT EXISTS game_actions (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID,
  action_type VARCHAR(50) NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bật Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;

-- Các chính sách bảo mật (Security Policies) - Cho phép đọc tự do để MVP đơn giản, 
-- hoặc cho phép các thành viên phòng đọc/ghi. Để thuận tiện MVP, ta cho phép các thao tác
-- công khai hoặc hạn chế theo phòng. Hãy cấu hình Policy đơn giản nhưng đầy đủ:
CREATE POLICY "Allow public read/write rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write room_players" ON room_players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write game_states" ON game_states FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write game_actions" ON game_actions FOR ALL USING (true) WITH CHECK (true);

-- Bật Realtime Replication cho Supabase
ALTER TABLE rooms REPLICA IDENTITY FULL;
ALTER TABLE room_players REPLICA IDENTITY FULL;
ALTER TABLE game_states REPLICA IDENTITY FULL;

-- Cố gắng thêm bảng vào ấn bản Realtime nếu có sẵn
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms, room_players, game_states;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE rooms, room_players, game_states;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Bỏ qua nếu có lỗi phân quyền
END $$;
-- Hàm tạo phòng
CREATE OR REPLACE FUNCTION create_room(
  p_host_user_id UUID,
  p_host_name TEXT,
  p_settings JSONB
) RETURNS TABLE (
  room_id UUID,
  room_code VARCHAR(6)
) AS $$
DECLARE
  v_room_code VARCHAR(6);
  v_room_id UUID;
BEGIN
  -- Tạo mã phòng ngẫu nhiên không trùng
  LOOP
    v_room_code := upper(substring(md5(random()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE room_code = v_room_code);
  END LOOP;

  -- Chèn phòng mới
  INSERT INTO rooms (room_code, host_id, status, settings)
  VALUES (v_room_code, p_host_user_id, 'WAITING', p_settings)
  RETURNING id INTO v_room_id;

  -- Chèn người chơi đầu tiên làm Host
  INSERT INTO room_players (room_id, user_id, display_name, turn_order, is_host)
  VALUES (v_room_id, p_host_user_id, p_host_name, 0, true);

  RETURN QUERY SELECT v_room_id, v_room_code;
END;
$$ LANGUAGE plpgsql;

-- Hàm vào phòng
CREATE OR REPLACE FUNCTION join_room(
  p_room_code TEXT,
  p_user_id UUID,
  p_display_name TEXT,
  p_avatar_color TEXT
) RETURNS UUID AS $$
DECLARE
  v_room_id UUID;
  v_status VARCHAR(20);
  v_max_players INT;
  v_current_players INT;
  v_turn_order INT;
BEGIN
  -- Lấy thông tin phòng
  SELECT id, status, (settings->>'maxPlayers')::int
  INTO v_room_id, v_status, v_max_players
  FROM rooms
  WHERE upper(room_code) = upper(p_room_code);

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Phòng không tồn tại';
  END IF;

  IF v_status != 'WAITING' THEN
    RAISE EXCEPTION 'Phòng không còn ở trạng thái chờ';
  END IF;

  -- Kiểm tra xem đã trong phòng chưa
  SELECT turn_order INTO v_turn_order
  FROM room_players
  WHERE room_id = v_room_id AND user_id = p_user_id;

  IF v_turn_order IS NOT NULL THEN
    -- Đã ở trong phòng, chỉ cập nhật tên/màu đại diện
    UPDATE room_players
    SET display_name = p_display_name, avatar_color = p_avatar_color
    WHERE room_id = v_room_id AND user_id = p_user_id;
    RETURN v_room_id;
  END IF;

  -- Kiểm tra số lượng người chơi
  SELECT count(*)::int INTO v_current_players
  FROM room_players
  WHERE room_id = v_room_id;

  IF v_current_players >= v_max_players THEN
    RAISE EXCEPTION 'Phòng đã đầy';
  END IF;

  -- Thêm người chơi mới
  INSERT INTO room_players (room_id, user_id, display_name, avatar_color, turn_order, is_host)
  VALUES (v_room_id, p_user_id, p_display_name, p_avatar_color, v_current_players, false);

  RETURN v_room_id;
END;
$$ LANGUAGE plpgsql;
-- Hàm khởi tạo trò chơi
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
  SELECT ((settings->>'startMoney')::int) INTO v_start_money FROM rooms WHERE id = p_room_id;
  IF v_start_money IS NULL THEN
    v_start_money := 1500;
  END IF;

  -- Kiểm tra số lượng người chơi
  SELECT count(*) INTO v_player_count FROM room_players WHERE room_id = p_room_id;
  IF v_player_count < 2 THEN
    RAISE EXCEPTION 'Trò chơi cần ít nhất 2 người chơi';
  END IF;

  -- Tạo danh sách người chơi dưới dạng JSONB
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', user_id,
      'name', display_name,
      'avatarColor', avatar_color,
      'cash', v_start_money,
      'position', 0,
      'inJail', false,
      'jailTurns', 0,
      'isBankrupt', false,
      'doubleRollCount', 0
    ) ORDER BY turn_order
  ) INTO v_players_json
  FROM room_players
  WHERE room_id = p_room_id;

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
-- Hàm đổ xúc xắc
CREATE OR REPLACE FUNCTION roll_dice(
  p_room_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_player RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_dice_1 INT;
  v_dice_2 INT;
  v_dice_sum INT;
  v_is_doubles BOOLEAN;
  v_new_pos INT;
  v_cash INT;
  v_in_jail BOOLEAN;
  v_jail_turns INT;
  v_double_count INT;
  v_log_text TEXT;
  v_phase VARCHAR(20) := 'resolve';
  v_temp_play JSONB;
BEGIN
  -- Lấy trạng thái game hiện tại
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase != 'roll' THEN
    RAISE EXCEPTION 'Không phải lúc tung xúc xắc';
  END IF;

  -- Lấy người chơi hiện tại dựa trên current_turn_index
  -- Cần chắc chắn người chơi đúng lượt gọi hàm
  v_temp_play := v_state.players->v_state.current_turn_index;
  IF v_temp_play IS NULL THEN
    RAISE EXCEPTION 'Lỗi chỉ số lượt đi';
  END IF;

  IF (v_temp_play->>'userId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Không phải lượt đi của bạn';
  END IF;

  IF (v_temp_play->>'isBankrupt')::boolean = true THEN
    RAISE EXCEPTION 'Bạn đã phá sản';
  END IF;

  -- Tung xúc xắc ngẫu nhiên từ 1-6
  v_dice_1 := floor(random() * 6)::int + 1;
  v_dice_2 := floor(random() * 6)::int + 1;
  v_dice_sum := v_dice_1 + v_dice_2;
  v_is_doubles := (v_dice_1 = v_dice_2);

  v_cash := (v_temp_play->>'cash')::int;
  v_new_pos := (v_temp_play->>'position')::int;
  v_in_jail := (v_temp_play->>'inJail')::boolean;
  v_jail_turns := (v_temp_play->>'jailTurns')::int;
  v_double_count := (v_temp_play->>'doubleRollCount')::int;

  v_log_text := (v_temp_play->>'name') || ' tung được ' || v_dice_1::text || ' & ' || v_dice_2::text || '.';

  IF v_in_jail THEN
    IF v_is_doubles THEN
      v_in_jail := false;
      v_jail_turns := 0;
      v_double_count := 0; -- Đổ xúc xắc đôi ra tù không được cộng lượt phụ
      v_new_pos := (v_new_pos + v_dice_sum) % 40;
      v_log_text := v_log_text || ' Ra tù thành công nhờ đổ xúc xắc đôi! Di chuyển đến ' || (v_state.board->v_new_pos->>'name') || '.';
      v_phase := 'resolve';
    ELSE
      v_jail_turns := v_jail_turns + 1;
      IF v_jail_turns >= 3 THEN
        v_in_jail := false;
        v_jail_turns := 0;
        v_double_count := 0;
        v_cash := v_cash - 50;
        v_new_pos := (v_new_pos + v_dice_sum) % 40;
        v_log_text := v_log_text || ' Lượt thứ 3 trong tù vẫn không đổ được đôi. Buộc nộp phạt 50 và di chuyển đến ' || (v_state.board->v_new_pos->>'name') || '.';
        v_phase := 'resolve';
      ELSE
        v_log_text := v_log_text || ' Vẫn ở trong tù (Lượt ' || v_jail_turns::text || '/3).';
        v_phase := 'end';
      END IF;
    END IF;
  ELSE
    -- Bình thường ngoài tù
    IF v_is_doubles THEN
      v_double_count := v_double_count + 1;
    ELSE
      v_double_count := 0;
    END IF;

    IF v_double_count = 3 THEN
      v_in_jail := true;
      v_jail_turns := 0;
      v_double_count := 0;
      v_new_pos := 10; -- Ô Nhà Tù
      v_log_text := v_log_text || ' 3 lần đổ xúc xắc đôi liên tiếp! Bị bắt đi tù ngay lập tức.';
      v_phase := 'end';
    ELSE
      -- Di chuyển
      DECLARE
        v_old_pos INT := v_new_pos;
      BEGIN
        v_new_pos := (v_new_pos + v_dice_sum) % 40;
        v_log_text := v_log_text || ' Di chuyển đến ' || (v_state.board->v_new_pos->>'name') || '.';

        -- Nhận tiền lương khi qua GO
        IF v_new_pos < v_old_pos THEN
          v_cash := v_cash + 200;
          v_log_text := v_log_text || ' Nhận 200 lương vượt qua cổng Khởi Hành (GO).';
        END IF;

        -- Rơi vào ô Vào Tù
        IF v_new_pos = 30 THEN
          v_in_jail := true;
          v_jail_turns := 0;
          v_double_count := 0;
          v_new_pos := 10;
          v_log_text := v_log_text || ' Vào ô Cảnh Sát Bắt! Bị áp giải đi tù ngay lập tức.';
          v_phase := 'end';
        ELSE
          -- Kiểm tra xem ô đó có cần giải quyết (resolve) không
          DECLARE
            v_tile JSONB := v_state.board->v_new_pos;
            v_tile_type TEXT := v_tile->>'type';
            v_owner TEXT := v_tile->>'ownerId';
          BEGIN
            IF v_tile_type = 'property' OR v_tile_type = 'railroad' OR v_tile_type = 'utility' THEN
              IF v_owner IS NULL THEN
                v_phase := 'resolve'; -- Để mua đất
              ELSIF v_owner = p_user_id::text THEN
                v_phase := 'action'; -- Đất của mình, có thể xây dựng hoặc kết thúc
              ELSE
                -- Cần trả tiền thuê
                IF (v_tile->>'mortgaged')::boolean = true THEN
                  v_phase := 'action'; -- Đất đang thế chấp, miễn phí thuê
                ELSE
                  v_phase := 'resolve'; -- Cần trả tiền thuê
                END IF;
              END IF;
            ELSIF v_tile_type = 'chance' OR v_tile_type = 'communitychest' OR v_tile_type = 'tax' THEN
              v_phase := 'resolve';
            ELSE
              v_phase := 'action'; -- Các ô Go, Jail, Free Parking... chỉ cần kết thúc hoặc thực hiện hành động
            END IF;
          END;
        END IF;
      END;
    END IF;
  END IF;

  -- Tạo danh sách người chơi mới với người chơi hiện tại đã cập nhật
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_state.current_turn_index THEN
      v_players_new := v_players_new || jsonb_build_object(
        'userId', p_user_id,
        'name', v_temp_play->>'name',
        'avatarColor', v_temp_play->>'avatarColor',
        'cash', v_cash,
        'position', v_new_pos,
        'inJail', v_in_jail,
        'jailTurns', v_jail_turns,
        'isBankrupt', false,
        'doubleRollCount', v_double_count
      );
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Nếu phase là 'action' nhưng không có thao tác gì thêm hoặc tự chuyển, 
  -- giao diện sẽ hiển thị nút "Kết thúc lượt"

  -- Cập nhật game_state
  UPDATE game_states SET
    players = v_players_new,
    last_dice = jsonb_build_array(v_dice_1, v_dice_2),
    turn_phase = v_phase,
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  -- Ghi log hành động vào game_actions
  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'roll_dice', jsonb_build_object('dice', ARRAY[v_dice_1, v_dice_2], 'position', v_new_pos));
END;
$$ LANGUAGE plpgsql;
-- Hàm mua đất
CREATE OR REPLACE FUNCTION buy_property(
  p_room_id UUID,
  p_user_id UUID,
  p_tile_index INT
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_player RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_board_new JSONB := '[]'::jsonb;
  v_tile JSONB;
  v_price INT;
  v_cash INT;
  v_temp_play JSONB;
  v_log_text TEXT;
BEGIN
  -- Lấy trạng thái game hiện tại
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase != 'resolve' THEN
    RAISE EXCEPTION 'Không phải lúc giải quyết ô';
  END IF;

  v_temp_play := v_state.players->v_state.current_turn_index;
  IF (v_temp_play->>'userId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Không phải lượt đi của bạn';
  END IF;

  IF (v_temp_play->>'position')::int != p_tile_index THEN
    RAISE EXCEPTION 'Vị trí của bạn không ở ô này';
  END IF;

  v_tile := v_state.board->p_tile_index;
  IF v_tile IS NULL THEN
    RAISE EXCEPTION 'Ô không hợp lệ';
  END IF;

  IF NOT (v_tile->>'type' = 'property' OR v_tile->>'type' = 'railroad' OR v_tile->>'type' = 'utility') THEN
    RAISE EXCEPTION 'Ô này không thể mua';
  END IF;

  IF v_tile->>'ownerId' IS NOT NULL THEN
    RAISE EXCEPTION 'Ô này đã có chủ sở hữu';
  END IF;

  v_price := (v_tile->>'price')::int;
  v_cash := (v_temp_play->>'cash')::int;

  IF v_cash < v_price THEN
    RAISE EXCEPTION 'Không đủ tiền để mua bất động sản này';
  END IF;

  -- Trừ tiền của người chơi
  v_cash := v_cash - v_price;
  v_log_text := (v_temp_play->>'name') || ' đã mua ' || (v_tile->>'name') || ' với giá ' || v_price::text || '.';

  -- Cập nhật người chơi
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_state.current_turn_index THEN
      v_players_new := v_players_new || jsonb_set(v_temp_play, '{cash}', to_jsonb(v_cash));
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Cập nhật ô đất trên Board
  FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
    IF i = p_tile_index THEN
      v_board_new := v_board_new || jsonb_set(v_tile, '{ownerId}', to_jsonb(p_user_id::text));
    ELSE
      v_board_new := v_board_new || (v_state.board->i);
    END IF;
  END LOOP;

  -- Cập nhật game_state
  UPDATE game_states SET
    players = v_players_new,
    board = v_board_new,
    turn_phase = 'action',
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'buy_property', jsonb_build_object('tileIndex', p_tile_index, 'price', v_price));
END;
$$ LANGUAGE plpgsql;


-- Hàm bỏ qua mua đất
CREATE OR REPLACE FUNCTION skip_buy(
  p_room_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_temp_play JSONB;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase != 'resolve' THEN
    RAISE EXCEPTION 'Không phải lúc giải quyết ô';
  END IF;

  v_temp_play := v_state.players->v_state.current_turn_index;
  IF (v_temp_play->>'userId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Không phải lượt đi của bạn';
  END IF;

  UPDATE game_states SET
    turn_phase = 'action',
    log = log || jsonb_build_object('time', now(), 'text', (v_temp_play->>'name') || ' quyết định không mua đất.'),
    updated_at = now()
  WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql;


-- Hàm trả tiền thuê đất
CREATE OR REPLACE FUNCTION pay_rent(
  p_room_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_temp_play JSONB;
  v_tile JSONB;
  v_owner_id UUID;
  v_owner_idx INT := -1;
  v_owner_play JSONB;
  v_rent INT := 0;
  v_cash_renter INT;
  v_cash_owner INT;
  v_pos INT;
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase != 'resolve' THEN
    RAISE EXCEPTION 'Không phải lúc giải quyết ô';
  END IF;

  v_temp_play := v_state.players->v_state.current_turn_index;
  IF (v_temp_play->>'userId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Không phải lượt đi của bạn';
  END IF;

  v_pos := (v_temp_play->>'position')::int;
  v_tile := v_state.board->v_pos;

  IF v_tile->>'ownerId' IS NULL THEN
    RAISE EXCEPTION 'Ô đất không có chủ để trả tiền thuê';
  END IF;

  v_owner_id := (v_tile->>'ownerId')::uuid;
  IF v_owner_id = p_user_id THEN
    RAISE EXCEPTION 'Bạn là chủ sở hữu ô này, không cần trả tiền thuê';
  END IF;

  -- Tìm index người chủ đất trong mảng players
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = v_owner_id THEN
      v_owner_idx := i;
      v_owner_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_owner_idx = -1 OR (v_owner_play->>'isBankrupt')::boolean = true THEN
    -- Nếu chủ đất đã phá sản hoặc không tìm thấy, chuyển sang phase action luôn
    UPDATE game_states SET turn_phase = 'action', updated_at = now() WHERE room_id = p_room_id;
    RETURN;
  END IF;

  -- Tính tiền thuê đất
  DECLARE
    v_type TEXT := v_tile->>'type';
    v_houses INT := (v_tile->>'houses')::int;
    v_color TEXT := v_tile->>'colorGroup';
  BEGIN
    IF v_type = 'property' THEN
      IF v_houses > 0 THEN
        v_rent := (v_tile->'rent'->v_houses)::int;
      ELSE
        -- Kiểm tra độc quyền (Monopoly) để nhân đôi tiền thuê nhà trống
        DECLARE
          v_total_in_group INT := 0;
          v_owned_in_group INT := 0;
          v_check_tile JSONB;
        BEGIN
          FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
            v_check_tile := v_state.board->i;
            IF v_check_tile->>'colorGroup' = v_color THEN
              v_total_in_group := v_total_in_group + 1;
              IF (v_check_tile->>'ownerId')::uuid = v_owner_id AND (v_check_tile->>'mortgaged')::boolean = false THEN
                v_owned_in_group := v_owned_in_group + 1;
              END IF;
            END IF;
          END LOOP;

          v_rent := (v_tile->'rent'->0)::int;
          IF v_total_in_group = v_owned_in_group THEN
            v_rent := v_rent * 2; -- Nhân đôi tiền thuê đất trống nếu độc quyền và không thế chấp
          END IF;
        END;
      END IF;
    ELSIF v_type = 'railroad' THEN
      -- Ga tàu
      DECLARE
        v_owned_railroads INT := 0;
        v_check_tile JSONB;
      BEGIN
        FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
          v_check_tile := v_state.board->i;
          IF v_check_tile->>'type' = 'railroad' AND (v_check_tile->>'ownerId')::uuid = v_owner_id THEN
            v_owned_railroads := v_owned_railroads + 1;
          END IF;
        END LOOP;

        IF v_owned_railroads = 1 THEN v_rent := 25;
        ELSIF v_owned_railroads = 2 THEN v_rent := 50;
        ELSIF v_owned_railroads = 3 THEN v_rent := 100;
        ELSIF v_owned_railroads = 4 THEN v_rent := 200;
        ELSE v_rent := 25;
        END IF;
      END;
    ELSIF v_type = 'utility' THEN
      -- Công ty Điện/Nước
      DECLARE
        v_owned_utilities INT := 0;
        v_check_tile JSONB;
        v_dice_sum INT := (v_state.last_dice->0)::int + (v_state.last_dice->1)::int;
      BEGIN
        FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
          v_check_tile := v_state.board->i;
          IF v_check_tile->>'type' = 'utility' AND (v_check_tile->>'ownerId')::uuid = v_owner_id THEN
            v_owned_utilities := v_owned_utilities + 1;
          END IF;
        END LOOP;

        IF v_owned_utilities = 2 THEN
          v_rent := v_dice_sum * 10;
        ELSE
          v_rent := v_dice_sum * 4;
        END IF;
      END;
    END IF;
  END;

  v_cash_renter := (v_temp_play->>'cash')::int - v_rent;
  v_cash_owner := (v_owner_play->>'cash')::int + v_rent;

  v_log_text := (v_temp_play->>'name') || ' trả ' || v_rent::text || ' tiền thuê đất tại ' || (v_tile->>'name') || ' cho ' || (v_owner_play->>'name') || '.';

  -- Cập nhật người chơi trong mảng players
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_state.current_turn_index THEN
      v_players_new := v_players_new || jsonb_set(v_temp_play, '{cash}', to_jsonb(v_cash_renter));
    ELSIF i = v_owner_idx THEN
      v_players_new := v_players_new || jsonb_set(v_owner_play, '{cash}', to_jsonb(v_cash_owner));
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Cập nhật game_state
  UPDATE game_states SET
    players = v_players_new,
    turn_phase = 'action', -- Sau khi trả tiền thuê xong, đi tới phase action để có thể bán nhà/thế chấp nếu âm tiền
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'pay_rent', jsonb_build_object('rent', v_rent, 'ownerId', v_owner_id));
END;
$$ LANGUAGE plpgsql;
-- Hàm xây nhà / nâng cấp khách sạn
CREATE OR REPLACE FUNCTION build_house(
  p_room_id UUID,
  p_user_id UUID,
  p_tile_index INT
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_board_new JSONB := '[]'::jsonb;
  v_tile JSONB;
  v_color TEXT;
  v_house_price INT;
  v_houses INT;
  v_cash INT;
  v_player_idx INT := -1;
  v_temp_play JSONB;
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  -- Tìm người chơi
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = p_user_id THEN
      v_player_idx := i;
      v_temp_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_player_idx = -1 OR (v_temp_play->>'isBankrupt')::boolean = true THEN
    RAISE EXCEPTION 'Người chơi không hợp lệ hoặc đã phá sản';
  END IF;

  v_tile := v_state.board->p_tile_index;
  IF v_tile IS NULL OR v_tile->>'ownerId' IS NULL OR (v_tile->>'ownerId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Bạn không sở hữu bất động sản này';
  END IF;

  IF v_tile->>'type' != 'property' THEN
    RAISE EXCEPTION 'Chỉ có thể xây nhà trên ô Đất Đai';
  END IF;

  IF (v_tile->>'mortgaged')::boolean = true THEN
    RAISE EXCEPTION 'Đất đang thế chấp, không thể xây nhà';
  END IF;

  v_houses := (v_tile->>'houses')::int;
  IF v_houses >= 5 THEN
    RAISE EXCEPTION 'Đã đạt giới hạn tối đa (1 Khách Sạn)';
  END IF;

  v_color := v_tile->>'colorGroup';
  v_house_price := (v_tile->>'housePrice')::int;
  v_cash := (v_temp_play->>'cash')::int;

  IF v_cash < v_house_price THEN
    RAISE EXCEPTION 'Không đủ tiền để xây nhà';
  END IF;

  -- Kiểm tra Độc Quyền (Monopoly) và Không thế chấp trong cùng nhóm màu
  DECLARE
    v_check_tile JSONB;
    v_total_in_group INT := 0;
    v_owned_in_group INT := 0;
    v_min_houses INT := 99;
    v_c_houses INT;
  BEGIN
    FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
      v_check_tile := v_state.board->i;
      IF v_check_tile->>'colorGroup' = v_color THEN
        v_total_in_group := v_total_in_group + 1;
        IF (v_check_tile->>'ownerId')::uuid = p_user_id THEN
          IF (v_check_tile->>'mortgaged')::boolean = true THEN
            RAISE EXCEPTION 'Một trong các ô thuộc nhóm màu đang bị thế chấp';
          END IF;
          v_owned_in_group := v_owned_in_group + 1;
          v_c_houses := (v_check_tile->>'houses')::int;
          IF v_c_houses < v_min_houses THEN
            v_min_houses := v_c_houses;
          END IF;
        END IF;
      END IF;
    END LOOP;

    IF v_total_in_group != v_owned_in_group THEN
      RAISE EXCEPTION 'Bạn phải sở hữu toàn bộ các ô cùng màu mới được phép xây nhà (Độc quyền)';
    END IF;

    -- Kiểm tra quy tắc xây dựng đồng đều (Even Building Rule)
    -- Số nhà trên ô hiện tại không được lớn hơn số nhà nhỏ nhất trong nhóm quá 1 căn
    IF v_houses > v_min_houses THEN
      RAISE EXCEPTION 'Quy tắc xây đồng đều: Cần nâng cấp các ô khác trong nhóm màu trước';
    END IF;
  END;

  -- Trừ tiền và tăng số nhà
  v_cash := v_cash - v_house_price;
  v_houses := v_houses + 1;

  IF v_houses = 5 THEN
    v_log_text := (v_temp_play->>'name') || ' đã nâng cấp khách sạn tại ' || (v_tile->>'name') || ' với giá ' || v_house_price::text || '.';
  ELSE
    v_log_text := (v_temp_play->>'name') || ' đã xây nhà thứ ' || v_houses::text || ' tại ' || (v_tile->>'name') || ' với giá ' || v_house_price::text || '.';
  END IF;

  -- Cập nhật players
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_player_idx THEN
      v_players_new := v_players_new || jsonb_set(v_temp_play, '{cash}', to_jsonb(v_cash));
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Cập nhật board
  FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
    IF i = p_tile_index THEN
      v_board_new := v_board_new || jsonb_set(v_tile, '{houses}', to_jsonb(v_houses));
    ELSE
      v_board_new := v_board_new || (v_state.board->i);
    END IF;
  END LOOP;

  -- Cập nhật game_state
  UPDATE game_states SET
    players = v_players_new,
    board = v_board_new,
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'build_house', jsonb_build_object('tileIndex', p_tile_index, 'houses', v_houses));
END;
$$ LANGUAGE plpgsql;


-- Hàm bán nhà / hạ cấp khách sạn
CREATE OR REPLACE FUNCTION sell_house(
  p_room_id UUID,
  p_user_id UUID,
  p_tile_index INT
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_board_new JSONB := '[]'::jsonb;
  v_tile JSONB;
  v_color TEXT;
  v_house_price INT;
  v_houses INT;
  v_cash INT;
  v_player_idx INT := -1;
  v_temp_play JSONB;
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = p_user_id THEN
      v_player_idx := i;
      v_temp_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_player_idx = -1 THEN
    RAISE EXCEPTION 'Người chơi không hợp lệ';
  END IF;

  v_tile := v_state.board->p_tile_index;
  IF v_tile IS NULL OR v_tile->>'ownerId' IS NULL OR (v_tile->>'ownerId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Bạn không sở hữu bất động sản này';
  END IF;

  v_houses := (v_tile->>'houses')::int;
  IF v_houses = 0 THEN
    RAISE EXCEPTION 'Ô này hiện chưa xây nhà';
  END IF;

  v_color := v_tile->>'colorGroup';
  v_house_price := (v_tile->>'housePrice')::int;
  v_cash := (v_temp_play->>'cash')::int;

  -- Kiểm tra quy tắc xây đều khi bán nhà (ngược lại): số nhà không được ít hơn số nhà cao nhất trong nhóm quá 1 căn
  DECLARE
    v_check_tile JSONB;
    v_max_houses INT := 0;
    v_c_houses INT;
  BEGIN
    FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
      v_check_tile := v_state.board->i;
      IF v_check_tile->>'colorGroup' = v_color AND (v_check_tile->>'ownerId')::uuid = p_user_id THEN
        v_c_houses := (v_check_tile->>'houses')::int;
        IF v_c_houses > v_max_houses THEN
          v_max_houses := v_c_houses;
        END IF;
      END IF;
    END LOOP;

    IF v_houses < v_max_houses THEN
      RAISE EXCEPTION 'Quy tắc xây đồng đều: Cần hạ cấp các ô có nhiều nhà hơn trước';
    END IF;
  END;

  -- Cộng lại 50% chi phí xây nhà và giảm số nhà
  v_cash := v_cash + (v_house_price / 2);
  v_houses := v_houses - 1;

  IF v_houses = 4 THEN
    v_log_text := (v_temp_play->>'name') || ' đã bán khách sạn (hạ xuống 4 nhà) tại ' || (v_tile->>'name') || ', nhận lại ' || (v_house_price / 2)::text || '.';
  ELSE
    v_log_text := (v_temp_play->>'name') || ' đã bán 1 nhà tại ' || (v_tile->>'name') || ', nhận lại ' || (v_house_price / 2)::text || '.';
  END IF;

  -- Cập nhật players
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_player_idx THEN
      v_players_new := v_players_new || jsonb_set(v_temp_play, '{cash}', to_jsonb(v_cash));
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Cập nhật board
  FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
    IF i = p_tile_index THEN
      v_board_new := v_board_new || jsonb_set(v_tile, '{houses}', to_jsonb(v_houses));
    ELSE
      v_board_new := v_board_new || (v_state.board->i);
    END IF;
  END LOOP;

  -- Cập nhật game_state
  UPDATE game_states SET
    players = v_players_new,
    board = v_board_new,
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'sell_house', jsonb_build_object('tileIndex', p_tile_index, 'houses', v_houses));
END;
$$ LANGUAGE plpgsql;


-- Hàm thế chấp / giải chấp bất động sản
CREATE OR REPLACE FUNCTION mortgage_property(
  p_room_id UUID,
  p_user_id UUID,
  p_tile_index INT
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_board_new JSONB := '[]'::jsonb;
  v_tile JSONB;
  v_price INT;
  v_cash INT;
  v_is_mortgaged BOOLEAN;
  v_player_idx INT := -1;
  v_temp_play JSONB;
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = p_user_id THEN
      v_player_idx := i;
      v_temp_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_player_idx = -1 THEN
    RAISE EXCEPTION 'Người chơi không hợp lệ';
  END IF;

  v_tile := v_state.board->p_tile_index;
  IF v_tile IS NULL OR v_tile->>'ownerId' IS NULL OR (v_tile->>'ownerId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Bạn không sở hữu bất động sản này';
  END IF;

  -- Kiểm tra xem có nhà trên đất không (chỉ áp dụng với property, không có nhà mới được thế chấp)
  IF (v_tile->>'type' = 'property') AND (v_tile->>'houses')::int > 0 THEN
    RAISE EXCEPTION 'Bạn phải bán toàn bộ nhà trên ô đất này trước khi thế chấp';
  END IF;

  v_price := (v_tile->>'price')::int;
  v_cash := (v_temp_play->>'cash')::int;
  v_is_mortgaged := (v_tile->>'mortgaged')::boolean;

  IF NOT v_is_mortgaged THEN
    -- Thế chấp: Nhận 50% giá trị đất
    v_cash := v_cash + (v_price / 2);
    v_is_mortgaged := true;
    v_log_text := (v_temp_play->>'name') || ' đã thế chấp ' || (v_tile->>'name') || ' và nhận về ' || (v_price / 2)::text || '.';
  ELSE
    -- Giải chấp: Trả lại số tiền vay + 10% lãi suất (tức 55% giá gốc)
    DECLARE
      v_redeem_cost INT := (v_price * 0.55)::int;
    BEGIN
      IF v_cash < v_redeem_cost THEN
        RAISE EXCEPTION 'Không đủ tiền để giải chấp bất động sản này (Cần %)', v_redeem_cost;
      END IF;
      v_cash := v_cash - v_redeem_cost;
      v_is_mortgaged := false;
      v_log_text := (v_temp_play->>'name') || ' đã giải chấp ' || (v_tile->>'name') || ' với chi phí ' || v_redeem_cost::text || '.';
    END;
  END IF;

  -- Cập nhật players
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_player_idx THEN
      v_players_new := v_players_new || jsonb_set(v_temp_play, '{cash}', to_jsonb(v_cash));
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Cập nhật board
  FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
    IF i = p_tile_index THEN
      v_board_new := v_board_new || jsonb_set(v_tile, '{mortgaged}', to_jsonb(v_is_mortgaged));
    ELSE
      v_board_new := v_board_new || (v_state.board->i);
    END IF;
  END LOOP;

  -- Cập nhật game_state
  UPDATE game_states SET
    players = v_players_new,
    board = v_board_new,
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'mortgage', jsonb_build_object('tileIndex', p_tile_index, 'isMortgaged', v_is_mortgaged));
END;
$$ LANGUAGE plpgsql;
-- Hàm rút thẻ Cơ Hội / Khí Vận
CREATE OR REPLACE FUNCTION draw_card(
  p_room_id UUID,
  p_user_id UUID,
  p_deck_type TEXT -- 'chance' hoặc 'communitychest'
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_deck JSONB;
  v_card JSONB;
  v_card_type TEXT;
  v_card_val INT;
  v_card_text TEXT;
  v_player_idx INT := -1;
  v_temp_play JSONB;
  v_cash INT;
  v_pos INT;
  v_in_jail BOOLEAN;
  v_jail_turns INT;
  v_double_count INT;
  v_jail_free_cards INT;
  v_new_deck JSONB := '[]'::jsonb;
  v_phase VARCHAR(20) := 'action';
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase != 'resolve' THEN
    RAISE EXCEPTION 'Không phải lúc rút thẻ';
  END IF;

  -- Tìm người chơi
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = p_user_id THEN
      v_player_idx := i;
      v_temp_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_player_idx = -1 OR (v_temp_play->>'isBankrupt')::boolean = true THEN
    RAISE EXCEPTION 'Người chơi không hợp lệ';
  END IF;

  -- Lấy bộ thẻ tương ứng
  IF p_deck_type = 'chance' THEN
    v_deck := v_state.chance_deck;
  ELSIF p_deck_type = 'communitychest' THEN
    v_deck := v_state.community_deck;
  ELSE
    RAISE EXCEPTION 'Bộ thẻ không hợp lệ';
  END IF;

  IF jsonb_array_length(v_deck) = 0 THEN
    RAISE EXCEPTION 'Bộ thẻ trống';
  END IF;

  -- Lấy thẻ trên cùng (phần tử số 0)
  v_card := v_deck->0;
  v_card_type := v_card->>'type';
  v_card_text := v_card->>'text';
  v_card_val := (v_card->>'value')::int;

  -- Xoay vòng bộ thẻ: xoá thẻ đầu tiên và chèn vào cuối bộ thẻ
  FOR i IN 1..(jsonb_array_length(v_deck) - 1) LOOP
    v_new_deck := v_new_deck || (v_deck->i);
  END LOOP;
  v_new_deck := v_new_deck || v_card;

  -- Thiết lập các giá trị ban đầu của người chơi
  v_cash := (v_temp_play->>'cash')::int;
  v_pos := (v_temp_play->>'position')::int;
  v_in_jail := (v_temp_play->>'inJail')::boolean;
  v_jail_turns := (v_temp_play->>'jailTurns')::int;
  v_double_count := (v_temp_play->>'doubleRollCount')::int;
  v_jail_free_cards := COALESCE((v_temp_play->>'jailFreeCards')::int, 0);

  v_log_text := (v_temp_play->>'name') || ' rút được thẻ ' || (CASE WHEN p_deck_type = 'chance' THEN 'Cơ Hội' ELSE 'Khí Vận' END) || ': "' || v_card_text || '".';

  -- Áp dụng hiệu ứng của thẻ
  IF v_card_type = 'money' THEN
    v_cash := v_cash + v_card_val;
  ELSIF v_card_type = 'move_to' THEN
    DECLARE
      v_old_pos INT := v_pos;
    BEGIN
      v_pos := v_card_val;
      -- Nhận 200 lương nếu đi qua GO
      IF v_pos < v_old_pos AND v_pos != 10 THEN
        v_cash := v_cash + 200;
        v_log_text := v_log_text || ' Nhận 200 lương khi vượt qua cổng Khởi Hành (GO).';
      END IF;

      -- Sau khi di chuyển, kiểm tra xem ô mới có cần giải quyết tiếp không (mua đất/trả tiền thuê)
      DECLARE
        v_new_tile JSONB := v_state.board->v_pos;
        v_tile_type TEXT := v_new_tile->>'type';
        v_owner TEXT := v_new_tile->>'ownerId';
      BEGIN
        IF v_tile_type = 'property' OR v_tile_type = 'railroad' OR v_tile_type = 'utility' THEN
          IF v_owner IS NULL THEN
            v_phase := 'resolve';
          ELSIF v_owner != p_user_id::text AND (v_new_tile->>'mortgaged')::boolean = false THEN
            v_phase := 'resolve';
          ELSE
            v_phase := 'action';
          END IF;
        ELSE
          v_phase := 'action';
        END IF;
      END;
    END;
  ELSIF v_card_type = 'move_steps' THEN
    -- Thường là đi lùi 3 ô
    v_pos := (v_pos + v_card_val + 40) % 40;
    -- Sau khi di chuyển lùi, kiểm tra ô mới
    DECLARE
      v_new_tile JSONB := v_state.board->v_pos;
      v_tile_type TEXT := v_new_tile->>'type';
      v_owner TEXT := v_new_tile->>'ownerId';
    BEGIN
      IF v_tile_type = 'property' OR v_tile_type = 'railroad' OR v_tile_type = 'utility' THEN
        IF v_owner IS NULL THEN
          v_phase := 'resolve';
        ELSIF v_owner != p_user_id::text AND (v_new_tile->>'mortgaged')::boolean = false THEN
          v_phase := 'resolve';
        ELSE
          v_phase := 'action';
        END IF;
      ELSE
        v_phase := 'action';
      END IF;
    END;
  ELSIF v_card_type = 'go_to_jail' THEN
    v_in_jail := true;
    v_jail_turns := 0;
    v_double_count := 0;
    v_pos := 10; -- Ô Nhà Tù
    v_phase := 'end';
  ELSIF v_card_type = 'jail_free' THEN
    v_jail_free_cards := v_jail_free_cards + 1;
  ELSIF v_card_type = 'birthday' THEN
    -- Mọi người chơi khác tặng bạn tiền
    DECLARE
      v_gift_sum INT := 0;
      v_other_play JSONB;
      v_other_cash INT;
    BEGIN
      FOR j IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
        IF j != v_player_idx THEN
          v_other_play := v_state.players->j;
          IF (v_other_play->>'isBankrupt')::boolean = false THEN
            v_gift_sum := v_gift_sum + v_card_val;
          END IF;
        END IF;
      END LOOP;
      v_cash := v_cash + v_gift_sum;
    END;
  END IF;

  -- Tạo danh sách người chơi mới
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_player_idx THEN
      -- Cập nhật người chơi rút thẻ
      v_players_new := v_players_new || jsonb_build_object(
        'userId', p_user_id,
        'name', v_temp_play->>'name',
        'avatarColor', v_temp_play->>'avatarColor',
        'cash', v_cash,
        'position', v_pos,
        'inJail', v_in_jail,
        'jailTurns', v_jail_turns,
        'isBankrupt', false,
        'doubleRollCount', v_double_count,
        'jailFreeCards', v_jail_free_cards
      );
    ELSE
      -- Nếu thẻ là Sinh Nhật, giảm tiền các người chơi khác
      DECLARE
        v_other_play JSONB := v_state.players->i;
        v_other_cash INT := (v_other_play->>'cash')::int;
      BEGIN
        IF v_card_type = 'birthday' AND (v_other_play->>'isBankrupt')::boolean = false THEN
          v_other_cash := v_other_cash - v_card_val;
          v_players_new := v_players_new || jsonb_set(v_other_play, '{cash}', to_jsonb(v_other_cash));
        ELSE
          v_players_new := v_players_new || v_other_play;
        END IF;
      END;
    END IF;
  END LOOP;

  -- Cập nhật game_states
  IF p_deck_type = 'chance' THEN
    UPDATE game_states SET
      players = v_players_new,
      chance_deck = v_new_deck,
      turn_phase = v_phase,
      log = log || jsonb_build_object('time', now(), 'text', v_log_text),
      updated_at = now()
    WHERE room_id = p_room_id;
  ELSE
    UPDATE game_states SET
      players = v_players_new,
      community_deck = v_new_deck,
      turn_phase = v_phase,
      log = log || jsonb_build_object('time', now(), 'text', v_log_text),
      updated_at = now()
    WHERE room_id = p_room_id;
  END IF;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'draw_card', jsonb_build_object('deckType', p_deck_type, 'card', v_card, 'position', v_pos));
END;
$$ LANGUAGE plpgsql;
-- Hàm tuyên bố phá sản
CREATE OR REPLACE FUNCTION declare_bankruptcy(
  p_room_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_board_new JSONB := '[]'::jsonb;
  v_player_idx INT := -1;
  v_temp_play JSONB;
  v_pos INT;
  v_tile JSONB;
  v_creditor_id UUID := NULL;
  v_creditor_idx INT := -1;
  v_creditor_play JSONB;
  v_log_text TEXT;
  v_active_players_count INT := 0;
  v_winner_id UUID := NULL;
  v_next_turn_idx INT;
  v_room_status VARCHAR(20) := 'PLAYING';
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  -- Tìm người chơi phá sản
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = p_user_id THEN
      v_player_idx := i;
      v_temp_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_player_idx = -1 OR (v_temp_play->>'isBankrupt')::boolean = true THEN
    RAISE EXCEPTION 'Người chơi không hợp lệ hoặc đã phá sản rồi';
  END IF;

  v_pos := (v_temp_play->>'position')::int;
  v_tile := v_state.board->v_pos;

  -- Xác định xem nợ Ngân Hàng hay nợ Người Chơi khác
  -- Nếu đang đứng ở ô đất của người khác và ô đó không thế chấp, đó chính là chủ nợ
  IF v_tile->>'ownerId' IS NOT NULL AND (v_tile->>'ownerId')::uuid != p_user_id AND (v_tile->>'mortgaged')::boolean = false THEN
    v_creditor_id := (v_tile->>'ownerId')::uuid;

    -- Tìm chỉ số của chủ nợ
    FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
      IF (v_state.players->i->>'userId')::uuid = v_creditor_id THEN
        v_creditor_idx := i;
        v_creditor_play := v_state.players->i;
      END IF;
    END LOOP;
  END IF;

  v_log_text := (v_temp_play->>'name') || ' đã tuyên bố phá sản!';

  -- Chuyển giao tài sản
  IF v_creditor_id IS NOT NULL AND v_creditor_idx != -1 THEN
    v_log_text := v_log_text || ' Toàn bộ tài sản còn lại được bàn giao cho chủ nợ ' || (v_creditor_play->>'name') || '.';
    
    -- Cập nhật chủ sở hữu các ô đất sang cho chủ nợ, giải phóng nhà/khách sạn
    FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
      DECLARE
        v_check_tile JSONB := v_state.board->i;
      BEGIN
        IF (v_check_tile->>'ownerId')::uuid = p_user_id THEN
          -- Chuyển chủ đất và huỷ toàn bộ nhà cửa
          v_check_tile := jsonb_set(v_check_tile, '{ownerId}', to_jsonb(v_creditor_id::text));
          v_check_tile := jsonb_set(v_check_tile, '{houses}', '0'::jsonb);
          v_board_new := v_board_new || v_check_tile;
        ELSE
          v_board_new := v_board_new || v_check_tile;
        END IF;
      END;
    END LOOP;
  ELSE
    v_log_text := v_log_text || ' Trả lại toàn bộ bất động sản về cho Ngân Hàng.';
    -- Nợ ngân hàng: Trả hết đất đai về vô chủ, xóa nhà cửa, bỏ thế chấp
    FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
      DECLARE
        v_check_tile JSONB := v_state.board->i;
      BEGIN
        IF (v_check_tile->>'ownerId')::uuid = p_user_id THEN
          v_check_tile := jsonb_set(v_check_tile, '{ownerId}', 'null'::jsonb);
          v_check_tile := jsonb_set(v_check_tile, '{houses}', '0'::jsonb);
          v_check_tile := jsonb_set(v_check_tile, '{mortgaged}', 'false'::jsonb);
          v_board_new := v_board_new || v_check_tile;
        ELSE
          v_board_new := v_board_new || v_check_tile;
        END IF;
      END;
    END LOOP;
  END IF;

  -- Tạo mảng người chơi mới
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_player_idx THEN
      -- Người chơi bị phá sản
      v_players_new := v_players_new || jsonb_build_object(
        'userId', p_user_id,
        'name', v_temp_play->>'name',
        'avatarColor', v_temp_play->>'avatarColor',
        'cash', 0,
        'position', v_pos,
        'inJail', false,
        'jailTurns', 0,
        'isBankrupt', true,
        'doubleRollCount', 0
      );
    ELSIF i = v_creditor_idx THEN
      -- Chủ nợ nhận số tiền mặt còn lại của con nợ (nếu có tiền dương, tuy nhiên thường con nợ âm tiền)
      -- Theo luật Monopoly, chủ nợ nhận toàn bộ tiền còn lại của con nợ trước khi tính nợ
      DECLARE
        v_debtor_cash INT := (v_temp_play->>'cash')::int;
        v_creditor_cash INT := (v_creditor_play->>'cash')::int;
      BEGIN
        IF v_debtor_cash > 0 THEN
          v_creditor_cash := v_creditor_cash + v_debtor_cash;
        END IF;
        v_players_new := v_players_new || jsonb_set(v_creditor_play, '{cash}', to_jsonb(v_creditor_cash));
      END;
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Đếm số người chơi chưa phá sản
  FOR i IN 0..(jsonb_array_length(v_players_new) - 1) LOOP
    IF (v_players_new->i->>'isBankrupt')::boolean = false THEN
      v_active_players_count := v_active_players_count + 1;
      v_winner_id := (v_players_new->i->>'userId')::uuid;
    END IF;
  END LOOP;

  -- Xác định chỉ số người chơi của lượt tiếp theo
  v_next_turn_idx := v_state.current_turn_index;

  IF v_active_players_count <= 1 THEN
    -- Trò chơi kết thúc
    v_room_status := 'FINISHED';
    v_log_text := v_log_text || ' Trò chơi kết thúc! Người chiến thắng là ' || 
                  (SELECT display_name FROM room_players WHERE room_id = p_room_id AND user_id = v_winner_id) || '.';
  ELSE
    -- Chuyển lượt đi nếu người phá sản là người đang đi lượt này
    IF v_state.current_turn_index = v_player_idx THEN
      LOOP
        v_next_turn_idx := (v_next_turn_idx + 1) % jsonb_array_length(v_players_new);
        EXIT WHEN (v_players_new->v_next_turn_idx->>'isBankrupt')::boolean = false;
      END LOOP;
    END IF;
  END IF;

  -- Cập nhật rooms
  IF v_room_status = 'FINISHED' THEN
    UPDATE rooms SET status = 'FINISHED' WHERE id = p_room_id;
  END IF;

  -- Cập nhật game_states
  UPDATE game_states SET
    players = v_players_new,
    board = v_board_new,
    current_turn_index = v_next_turn_idx,
    turn_phase = 'roll', -- Lượt mới luôn bắt đầu bằng đổ xúc xắc
    winner_id = v_winner_id,
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'bankrupt', jsonb_build_object('creditorId', v_creditor_id));
END;
$$ LANGUAGE plpgsql;
-- Hàm kết thúc lượt đi
CREATE OR REPLACE FUNCTION end_turn(
  p_room_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_temp_play JSONB;
  v_player_idx INT := -1;
  v_cash INT;
  v_in_jail BOOLEAN;
  v_double_count INT;
  v_next_turn_idx INT;
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase NOT IN ('action', 'end') THEN
    RAISE EXCEPTION 'Bạn chưa hoàn thành các giải quyết trong lượt này';
  END IF;

  v_temp_play := v_state.players->v_state.current_turn_index;
  IF (v_temp_play->>'userId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Không phải lượt đi của bạn';
  END IF;

  v_cash := (v_temp_play->>'cash')::int;
  v_in_jail := (v_temp_play->>'inJail')::boolean;
  v_double_count := (v_temp_play->>'doubleRollCount')::int;

  -- Kiểm tra xem người chơi có đang âm tiền không
  IF v_cash < 0 THEN
    RAISE EXCEPTION 'Bạn đang bị âm tiền! Hãy thế chấp tài sản, bán nhà hoặc tuyên bố phá sản để trả nợ trước khi kết thúc lượt';
  END IF;

  -- Xác định người chơi tiếp theo
  IF v_double_count > 0 AND NOT v_in_jail THEN
    -- Nếu đổ xúc xắc đôi và không bị vào tù, người chơi hiện tại được đi tiếp
    v_next_turn_idx := v_state.current_turn_index;
    v_log_text := (v_temp_play->>'name') || ' được đi thêm lượt phụ nhờ đổ xúc xắc đôi!';
  ELSE
    -- Chuyển lượt sang người chơi tiếp theo chưa phá sản
    v_next_turn_idx := v_state.current_turn_index;
    LOOP
      v_next_turn_idx := (v_next_turn_idx + 1) % jsonb_array_length(v_state.players);
      EXIT WHEN (v_state.players->v_next_turn_idx->>'isBankrupt')::boolean = false;
    END LOOP;
    
    v_log_text := 'Lượt đi chuyển sang cho ' || (v_state.players->v_next_turn_idx->>'name') || '.';
  END IF;

  -- Đặt lại doubleRollCount của người chơi vừa đi xong về 0
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_state.current_turn_index THEN
      v_players_new := v_players_new || jsonb_set(v_temp_play, '{doubleRollCount}', '0'::jsonb);
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Cập nhật game_states
  UPDATE game_states SET
    players = v_players_new,
    current_turn_index = v_next_turn_idx,
    turn_phase = 'roll', -- Lượt mới luôn bắt đầu bằng 'roll'
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'end_turn', jsonb_build_object('nextPlayerIndex', v_next_turn_idx));
END;
$$ LANGUAGE plpgsql;
-- Hàm trả tiền phạt ra tù
CREATE OR REPLACE FUNCTION pay_jail_fine(
  p_room_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_temp_play JSONB;
  v_player_idx INT := -1;
  v_cash INT;
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase != 'roll' THEN
    RAISE EXCEPTION 'Bạn chỉ có thể trả tiền phạt ở đầu lượt chơi';
  END IF;

  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = p_user_id THEN
      v_player_idx := i;
      v_temp_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_player_idx = -1 OR (v_temp_play->>'isBankrupt')::boolean = true THEN
    RAISE EXCEPTION 'Người chơi không hợp lệ';
  END IF;

  IF (v_temp_play->>'inJail')::boolean = false THEN
    RAISE EXCEPTION 'Bạn không ở trong tù';
  END IF;

  v_cash := (v_temp_play->>'cash')::int;
  IF v_cash < 50 THEN
    RAISE EXCEPTION 'Bạn không đủ tiền để nộp phạt (Cần 50)';
  END IF;

  v_cash := v_cash - 50;
  v_log_text := (v_temp_play->>'name') || ' đã trả 50 tiền phạt để ra tù.';

  -- Cập nhật người chơi
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_player_idx THEN
      v_players_new := v_players_new || jsonb_build_object(
        'userId', p_user_id,
        'name', v_temp_play->>'name',
        'avatarColor', v_temp_play->>'avatarColor',
        'cash', v_cash,
        'position', (v_temp_play->>'position')::int,
        'inJail', false,
        'jailTurns', 0,
        'isBankrupt', false,
        'doubleRollCount', 0,
        'jailFreeCards', COALESCE((v_temp_play->>'jailFreeCards')::int, 0)
      );
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  UPDATE game_states SET
    players = v_players_new,
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'pay_jail_fine', jsonb_build_object('fine', 50));
END;
$$ LANGUAGE plpgsql;


-- Hàm sử dụng thẻ ra tù miễn phí
CREATE OR REPLACE FUNCTION use_jail_free_card(
  p_room_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_temp_play JSONB;
  v_player_idx INT := -1;
  v_jail_free_cards INT;
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase != 'roll' THEN
    RAISE EXCEPTION 'Bạn chỉ có thể dùng thẻ thoát tù ở đầu lượt chơi';
  END IF;

  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = p_user_id THEN
      v_player_idx := i;
      v_temp_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_player_idx = -1 OR (v_temp_play->>'isBankrupt')::boolean = true THEN
    RAISE EXCEPTION 'Người chơi không hợp lệ';
  END IF;

  IF (v_temp_play->>'inJail')::boolean = false THEN
    RAISE EXCEPTION 'Bạn không ở trong tù';
  END IF;

  v_jail_free_cards := COALESCE((v_temp_play->>'jailFreeCards')::int, 0);
  IF v_jail_free_cards <= 0 THEN
    RAISE EXCEPTION 'Bạn không có thẻ thoát tù miễn phí';
  END IF;

  v_jail_free_cards := v_jail_free_cards - 1;
  v_log_text := (v_temp_play->>'name') || ' đã sử dụng "Thẻ thoát tù miễn phí" để ra tù.';

  -- Cập nhật người chơi
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_player_idx THEN
      v_players_new := v_players_new || jsonb_build_object(
        'userId', p_user_id,
        'name', v_temp_play->>'name',
        'avatarColor', v_temp_play->>'avatarColor',
        'cash', (v_temp_play->>'cash')::int,
        'position', (v_temp_play->>'position')::int,
        'inJail', false,
        'jailTurns', 0,
        'isBankrupt', false,
        'doubleRollCount', 0,
        'jailFreeCards', v_jail_free_cards
      );
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  UPDATE game_states SET
    players = v_players_new,
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'use_jail_free_card', '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;
-- Bảng lưu trữ giao dịch trao đổi
CREATE TABLE IF NOT EXISTS game_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  proposer_cash INT DEFAULT 0,
  proposer_properties INT[] DEFAULT '{}',
  receiver_cash INT DEFAULT 0,
  receiver_properties INT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kích hoạt RLS cho bảng giao dịch
ALTER TABLE game_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write game_trades" ON game_trades FOR ALL USING (true) WITH CHECK (true);

-- Bật Realtime Replication cho game_trades
ALTER TABLE game_trades REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_trades;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Bỏ qua lỗi phân quyền
END $$;

-- Hàm đề xuất trao đổi
CREATE OR REPLACE FUNCTION propose_trade(
  p_room_id UUID,
  p_proposer_id UUID,
  p_receiver_id UUID,
  p_proposer_cash INT,
  p_proposer_properties INT[],
  p_receiver_cash INT,
  p_receiver_properties INT[]
) RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_state RECORD;
  v_proposer_play JSONB;
  v_receiver_play JSONB;
  v_tile JSONB;
BEGIN
  -- Lấy trạng thái game để kiểm tra xem tài sản đề xuất có khớp không
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  -- Kiểm tra xem người đề xuất có sở hữu đủ đất đai đề cập và không có nhà cửa trên đó không
  IF p_proposer_properties IS NOT NULL AND cardinality(p_proposer_properties) > 0 THEN
    FOR i IN 1..cardinality(p_proposer_properties) LOOP
      v_tile := v_state.board->(p_proposer_properties[i]);
      IF v_tile IS NULL OR (v_tile->>'ownerId')::uuid != p_proposer_id THEN
        RAISE EXCEPTION 'Bạn không sở hữu ô đất đề xuất trao đổi (Ô số %)', p_proposer_properties[i];
      END IF;
      IF (v_tile->>'houses')::int > 0 THEN
        RAISE EXCEPTION 'Không thể trao đổi ô đất đang có nhà, hãy bán nhà trước';
      END IF;
    END LOOP;
  END IF;

  -- Kiểm tra xem người nhận có sở hữu đủ đất đai yêu cầu và không có nhà cửa trên đó không
  IF p_receiver_properties IS NOT NULL AND cardinality(p_receiver_properties) > 0 THEN
    FOR i IN 1..cardinality(p_receiver_properties) LOOP
      v_tile := v_state.board->(p_receiver_properties[i]);
      IF v_tile IS NULL OR (v_tile->>'ownerId')::uuid != p_receiver_id THEN
        RAISE EXCEPTION 'Đối tác không sở hữu ô đất yêu cầu trao đổi (Ô số %)', p_receiver_properties[i];
      END IF;
      IF (v_tile->>'houses')::int > 0 THEN
        RAISE EXCEPTION 'Không thể trao đổi ô đất đang có nhà';
      END IF;
    END LOOP;
  END IF;

  -- Huỷ các giao dịch cũ đang PENDING giữa 2 người này trong phòng để tránh rác dữ liệu
  UPDATE game_trades 
  SET status = 'REJECTED' 
  WHERE room_id = p_room_id AND proposer_id = p_proposer_id AND receiver_id = p_receiver_id AND status = 'PENDING';

  -- Chèn giao dịch mới
  INSERT INTO game_trades (
    room_id, proposer_id, receiver_id, 
    proposer_cash, proposer_properties, 
    receiver_cash, receiver_properties, 
    status
  ) VALUES (
    p_room_id, p_proposer_id, p_receiver_id,
    p_proposer_cash, p_proposer_properties,
    p_receiver_cash, p_receiver_properties,
    'PENDING'
  )
  RETURNING id INTO v_trade_id;

  RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql;


-- Hàm chấp nhận trao đổi
CREATE OR REPLACE FUNCTION accept_trade(
  p_trade_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_board_new JSONB := '[]'::jsonb;
  v_proposer_idx INT := -1;
  v_receiver_idx INT := -1;
  v_proposer_play JSONB;
  v_receiver_play JSONB;
  v_proposer_cash INT;
  v_receiver_cash INT;
  v_tile JSONB;
  v_log_text TEXT;
BEGIN
  -- Lấy thông tin giao dịch trao đổi
  SELECT * INTO v_trade FROM game_trades WHERE id = p_trade_id FOR UPDATE;
  IF v_trade IS NULL THEN
    RAISE EXCEPTION 'Giao dịch không tồn tại';
  END IF;

  IF v_trade.status != 'PENDING' THEN
    RAISE EXCEPTION 'Giao dịch không còn ở trạng thái chờ';
  END IF;

  IF v_trade.receiver_id != p_user_id THEN
    RAISE EXCEPTION 'Bạn không phải là người nhận đề xuất này';
  END IF;

  -- Lấy trạng thái game hiện tại
  SELECT * INTO v_state FROM game_states WHERE room_id = v_trade.room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  -- Tìm thông tin 2 người chơi
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF (v_state.players->i->>'userId')::uuid = v_trade.proposer_id THEN
      v_proposer_idx := i;
      v_proposer_play := v_state.players->i;
    ELSIF (v_state.players->i->>'userId')::uuid = v_trade.receiver_id THEN
      v_receiver_idx := i;
      v_receiver_play := v_state.players->i;
    END IF;
  END LOOP;

  IF v_proposer_idx = -1 OR (v_proposer_play->>'isBankrupt')::boolean = true THEN
    RAISE EXCEPTION 'Người đề xuất không hợp lệ hoặc đã phá sản';
  END IF;

  IF v_receiver_idx = -1 OR (v_receiver_play->>'isBankrupt')::boolean = true THEN
    RAISE EXCEPTION 'Bạn không hợp lệ hoặc đã phá sản';
  END IF;

  -- Kiểm tra xem tiền mặt của người đề xuất có đủ không
  v_proposer_cash := (v_proposer_play->>'cash')::int - v_trade.proposer_cash + v_trade.receiver_cash;
  IF (v_proposer_play->>'cash')::int < v_trade.proposer_cash THEN
    RAISE EXCEPTION 'Đối tác không đủ tiền mặt để thực hiện giao dịch này';
  END IF;

  -- Kiểm tra tiền mặt của người nhận có đủ không
  v_receiver_cash := (v_receiver_play->>'cash')::int - v_trade.receiver_cash + v_trade.proposer_cash;
  IF (v_receiver_play->>'cash')::int < v_trade.receiver_cash THEN
    RAISE EXCEPTION 'Bạn không đủ tiền mặt để thực hiện giao dịch này';
  END IF;

  -- Xác minh quyền sở hữu tài sản của người đề xuất
  IF v_trade.proposer_properties IS NOT NULL AND cardinality(v_trade.proposer_properties) > 0 THEN
    FOR i IN 1..cardinality(v_trade.proposer_properties) LOOP
      v_tile := v_state.board->(v_trade.proposer_properties[i]);
      IF v_tile IS NULL OR (v_tile->>'ownerId')::uuid != v_trade.proposer_id THEN
        RAISE EXCEPTION 'Tài sản đề xuất không còn thuộc sở hữu của người đề xuất (Ô số %)', v_trade.proposer_properties[i];
      END IF;
      IF (v_tile->>'houses')::int > 0 THEN
        RAISE EXCEPTION 'Một số ô đất đề xuất có nhà, không thể giao dịch';
      END IF;
    END LOOP;
  END IF;

  -- Xác minh quyền sở hữu tài sản của người nhận
  IF v_trade.receiver_properties IS NOT NULL AND cardinality(v_trade.receiver_properties) > 0 THEN
    FOR i IN 1..cardinality(v_trade.receiver_properties) LOOP
      v_tile := v_state.board->(v_trade.receiver_properties[i]);
      IF v_tile IS NULL OR (v_tile->>'ownerId')::uuid != v_trade.receiver_id THEN
        RAISE EXCEPTION 'Tài sản yêu cầu không còn thuộc sở hữu của bạn (Ô số %)', v_trade.receiver_properties[i];
      END IF;
      IF (v_tile->>'houses')::int > 0 THEN
        RAISE EXCEPTION 'Một số ô đất yêu cầu có nhà, không thể giao dịch';
      END IF;
    END LOOP;
  END IF;

  -- Cập nhật người chơi
  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_proposer_idx THEN
      v_players_new := v_players_new || jsonb_set(v_proposer_play, '{cash}', to_jsonb(v_proposer_cash));
    ELSIF i = v_receiver_idx THEN
      v_players_new := v_players_new || jsonb_set(v_receiver_play, '{cash}', to_jsonb(v_receiver_cash));
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  -- Cập nhật board: Hoán đổi chủ sở hữu các ô đất
  FOR i IN 0..(jsonb_array_length(v_state.board) - 1) LOOP
    v_tile := v_state.board->i;
    -- Kiểm tra xem ô i có trong danh sách proposer_properties không
    DECLARE
      v_found_proposer BOOLEAN := false;
      v_found_receiver BOOLEAN := false;
    BEGIN
      IF v_trade.proposer_properties IS NOT NULL THEN
        FOR j IN 1..cardinality(v_trade.proposer_properties) LOOP
          IF v_trade.proposer_properties[j] = i THEN
            v_found_proposer := true;
          END IF;
        END LOOP;
      END IF;

      IF v_trade.receiver_properties IS NOT NULL THEN
        FOR j IN 1..cardinality(v_trade.receiver_properties) LOOP
          IF v_trade.receiver_properties[j] = i THEN
            v_found_receiver := true;
          END IF;
        END LOOP;
      END IF;

      IF v_found_proposer THEN
        -- Chuyển từ proposer sang receiver
        v_board_new := v_board_new || jsonb_set(v_tile, '{ownerId}', to_jsonb(v_trade.receiver_id::text));
      ELSIF v_found_receiver THEN
        -- Chuyển từ receiver sang proposer
        v_board_new := v_board_new || jsonb_set(v_tile, '{ownerId}', to_jsonb(v_trade.proposer_id::text));
      ELSE
        v_board_new := v_board_new || v_tile;
      END IF;
    END;
  END LOOP;

  v_log_text := (v_receiver_play->>'name') || ' đã chấp nhận lời đề nghị trao đổi từ ' || (v_proposer_play->>'name') || '!';

  -- Cập nhật trạng thái giao dịch trao đổi
  UPDATE game_trades SET status = 'ACCEPTED' WHERE id = p_trade_id;

  -- Cập nhật game_states
  UPDATE game_states SET
    players = v_players_new,
    board = v_board_new,
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = v_trade.room_id;

  -- Log hành động
  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (v_trade.room_id, p_user_id, 'accept_trade', jsonb_build_object('tradeId', p_trade_id));
END;
$$ LANGUAGE plpgsql;


-- Hàm từ chối trao đổi
CREATE OR REPLACE FUNCTION reject_trade(
  p_trade_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_proposer_name TEXT;
  v_receiver_name TEXT;
BEGIN
  SELECT * INTO v_trade FROM game_trades WHERE id = p_trade_id FOR UPDATE;
  IF v_trade IS NULL THEN
    RAISE EXCEPTION 'Giao dịch không tồn tại';
  END IF;

  IF v_trade.status != 'PENDING' THEN
    RAISE EXCEPTION 'Giao dịch không còn ở trạng thái chờ';
  END IF;

  IF v_trade.receiver_id != p_user_id AND v_trade.proposer_id != p_user_id THEN
    RAISE EXCEPTION 'Bạn không có quyền hủy giao dịch này';
  END IF;

  UPDATE game_trades SET status = 'REJECTED' WHERE id = p_trade_id;

  -- Ghi nhận log từ chối trong game_state nếu cần
  -- Lấy tên người chơi
  SELECT display_name INTO v_receiver_name FROM room_players WHERE room_id = v_trade.room_id AND user_id = v_trade.receiver_id;
  SELECT display_name INTO v_proposer_name FROM room_players WHERE room_id = v_trade.room_id AND user_id = v_trade.proposer_id;

  UPDATE game_states 
  SET log = log || jsonb_build_object('time', now(), 'text', COALESCE(v_receiver_name, 'Đối tác') || ' đã từ chối đề nghị trao đổi từ ' || COALESCE(v_proposer_name, 'người chơi') || '.')
  WHERE room_id = v_trade.room_id;
END;
$$ LANGUAGE plpgsql;

-- Hàm nộp thuế
CREATE OR REPLACE FUNCTION pay_tax(
  p_room_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_state RECORD;
  v_players_new JSONB := '[]'::jsonb;
  v_temp_play JSONB;
  v_player_idx INT := -1;
  v_pos INT;
  v_tile JSONB;
  v_tax INT;
  v_cash INT;
  v_log_text TEXT;
BEGIN
  SELECT * INTO v_state FROM game_states WHERE room_id = p_room_id FOR UPDATE;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Trò chơi chưa bắt đầu';
  END IF;

  IF v_state.turn_phase != 'resolve' THEN
    RAISE EXCEPTION 'Không phải lúc nộp thuế';
  END IF;

  v_temp_play := v_state.players->v_state.current_turn_index;
  IF (v_temp_play->>'userId')::uuid != p_user_id THEN
    RAISE EXCEPTION 'Không phải lượt đi của bạn';
  END IF;

  v_pos := (v_temp_play->>'position')::int;
  v_tile := v_state.board->v_pos;

  IF v_tile->>'type' != 'tax' THEN
    RAISE EXCEPTION 'Bạn không đứng ở ô thuế';
  END IF;

  v_tax := (v_tile->>'price')::int;
  v_cash := (v_temp_play->>'cash')::int - v_tax;

  v_log_text := (v_temp_play->>'name') || ' đã nộp thuế ' || v_tax::text || ' cho Ngân hàng.';

  FOR i IN 0..(jsonb_array_length(v_state.players) - 1) LOOP
    IF i = v_state.current_turn_index THEN
      v_players_new := v_players_new || jsonb_set(v_temp_play, '{cash}', to_jsonb(v_cash));
    ELSE
      v_players_new := v_players_new || (v_state.players->i);
    END IF;
  END LOOP;

  UPDATE game_states SET
    players = v_players_new,
    turn_phase = 'action',
    log = log || jsonb_build_object('time', now(), 'text', v_log_text),
    updated_at = now()
  WHERE room_id = p_room_id;

  INSERT INTO game_actions (room_id, user_id, action_type, payload)
  VALUES (p_room_id, p_user_id, 'pay_tax', jsonb_build_object('tax', v_tax));
END;
$$ LANGUAGE plpgsql;

