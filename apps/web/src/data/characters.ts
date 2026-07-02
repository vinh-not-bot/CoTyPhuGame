/**
 * Hệ thống nhân vật nổi tiếng - Cờ Tỷ Phú Online
 * Mỗi nhân vật có 1 skill passive + 3 active skills (có thời gian hồi theo lượt)
 */

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  type: 'attack' | 'utility' | 'defense';
  cooldown: number; // số lượt hồi chiêu
  vfx: 'fist' | 'beam' | 'shield';
}

export interface CharacterDef {
  id: string;
  name: string;
  emoji: string;
  title: string;
  color: string;
  bgGradient: string;
  avatarUrl: string;
  passiveName: string;
  passiveDesc: string;
  passiveIcon: string;
  skills: SkillDef[]; // 3 Active skills
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'huan_hoa_hong',
    name: 'Huấn Hoa Hồng',
    emoji: '🌹',
    title: 'Ông Trùm Ngoại Giao',
    color: '#e11d48',
    bgGradient: 'linear-gradient(135deg, #881337 0%, #e11d48 50%, #fb7185 100%)',
    avatarUrl: '/characters/huan_hoa_hong.png',
    passiveName: 'Ngoại Giao',
    passiveDesc: 'Giảm 20% tiền thuê đất phải trả',
    passiveIcon: '🤝',
    skills: [
      { id: 'huan_punch', name: 'Đấm Cướp Tiền', desc: 'Đấm cướp $100 của một đối thủ ngẫu nhiên', icon: '👊', type: 'attack', cooldown: 3, vfx: 'fist' },
      { id: 'huan_shield', name: 'Vương Bài Tránh Thuế', desc: 'Bảo hộ bản thân khỏi thuế quốc gia trong 1 lượt', icon: '🛡️', type: 'defense', cooldown: 4, vfx: 'shield' },
      { id: 'huan_beam', name: 'Hút Lộc Giang Hồ', desc: 'Hút $120 chia đều từ tất cả người chơi', icon: '💸', type: 'attack', cooldown: 5, vfx: 'beam' }
    ]
  },
  {
    id: 'kha_banh',
    name: 'Khá Bảnh',
    emoji: '💎',
    title: 'Tay Chơi Đường Phố',
    color: '#7c3aed',
    bgGradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a78bfa 100%)',
    avatarUrl: '/characters/kha_banh.png',
    passiveName: 'Tay Chơi',
    passiveDesc: 'Nhận $220 thay vì $200 khi qua GO',
    passiveIcon: '💰',
    skills: [
      { id: 'banh_dance', name: 'Múa Quạt Ảo Ảnh', desc: 'Gây choáng đối thủ tiếp theo, họ phải đứng im 1 lượt', icon: '🪭', type: 'attack', cooldown: 4, vfx: 'fist' },
      { id: 'banh_gold', name: 'Đua Xe Thu Thuế', desc: 'Dịch chuyển đến ô Thuế tiếp theo và cướp $150 từ Ngân hàng', icon: '🏍️', type: 'utility', cooldown: 5, vfx: 'beam' },
      { id: 'banh_shield', name: 'Dân Chơi Không Sợ', desc: 'Bảo hộ không phải trả tiền thuê đất trong lượt tiếp theo', icon: '🛡️', type: 'defense', cooldown: 5, vfx: 'shield' }
    ]
  },
  {
    id: 'donald_trump',
    name: 'Donald Trump',
    emoji: '🏛️',
    title: 'Đế Chế Bất Động Sản',
    color: '#dc2626',
    bgGradient: 'linear-gradient(135deg, #1e3a5f 0%, #dc2626 50%, #fbbf24 100%)',
    avatarUrl: '/characters/donald_trump.png',
    passiveName: 'Đế Chế BĐS',
    passiveDesc: 'Xây nhà rẻ hơn 10% chi phí',
    passiveIcon: '🏗️',
    skills: [
      { id: 'trump_wall', name: 'Xây Vạn Lý Trường Thành', desc: 'Ngăn chặn bất kỳ ai đi qua ô đất của bạn trong 1 lượt', icon: '🧱', type: 'defense', cooldown: 4, vfx: 'shield' },
      { id: 'trump_tax', name: 'Thuế Quan Trừng Phạt', desc: 'Phạt đối thủ đứng đầu $150 nộp vào tài khoản của bạn', icon: '📈', type: 'attack', cooldown: 3, vfx: 'beam' },
      { id: 'trump_deal', name: 'Art of Deal', desc: 'Ép mua lại đất trống hoặc ga tàu của đối thủ với giá gốc x1.5', icon: '🤝', type: 'utility', cooldown: 6, vfx: 'fist' }
    ]
  },
  {
    id: 'obama',
    name: 'Barack Obama',
    emoji: '✊',
    title: 'Nhà Lãnh Đạo Nhân Dân',
    color: '#2563eb',
    bgGradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #93c5fd 100%)',
    avatarUrl: '/characters/obama.png',
    passiveName: 'Yes We Can',
    passiveDesc: 'Rút thẻ Cơ Hội/Khí Vận: nhận thêm $50',
    passiveIcon: '🗳️',
    skills: [
      { id: 'obama_reform', name: 'Cải Cách Y Tế', desc: 'Hồi phục tài chính: Tặng bạn $150 từ quỹ phúc lợi ngân hàng', icon: '🏥', type: 'utility', cooldown: 4, vfx: 'beam' },
      { id: 'obama_peace', name: 'Ngoại Giao Hòa Bình', desc: 'Ngăn chặn mọi đòn tấn công cướp tiền từ người khác trong 2 lượt', icon: '🕊️', type: 'defense', cooldown: 5, vfx: 'shield' },
      { id: 'obama_speech', name: 'Diễn Thuyết Hòa Hợp', desc: 'Khiến một đối thủ tự nguyện tặng bạn $80 tiền hỗ trợ', icon: '🎙️', type: 'attack', cooldown: 3, vfx: 'fist' }
    ]
  },
  {
    id: 'do_mixi',
    name: 'Độ Mixi',
    emoji: '🎮',
    title: 'Streamer Huyền Thoại',
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #78350f 0%, #f59e0b 50%, #fde68a 100%)',
    avatarUrl: '/characters/do_mixi.png',
    passiveName: 'Streamer Luck',
    passiveDesc: 'Đổ xúc xắc đôi: được cộng thêm 1 bước',
    passiveIcon: '🍀',
    skills: [
      { id: 'mixi_donate', name: 'Cơn Mưa Donate', desc: 'Kêu gọi donate từ tất cả người chơi khác, mỗi người gửi bạn $50', icon: '💸', type: 'attack', cooldown: 3, vfx: 'beam' },
      { id: 'mixi_pat', name: 'Lương Lẹo Né Thuế', desc: 'Sử dụng kỹ năng né tránh đóng thuế 1 lần', icon: '🥋', type: 'defense', cooldown: 4, vfx: 'shield' },
      { id: 'mixi_punch', name: 'Đấm Phát Chết Luôn', desc: 'Đấm gục 1 đối thủ ngẫu nhiên và cướp $120', icon: '👊', type: 'attack', cooldown: 4, vfx: 'fist' }
    ]
  },
  {
    id: 'elon_musk',
    name: 'Elon Musk',
    emoji: '🚀',
    title: 'Thiên Tài Công Nghệ',
    color: '#0ea5e9',
    bgGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 50%, #7dd3fc 100%)',
    avatarUrl: '/characters/elon_musk.png',
    passiveName: 'Innovation',
    passiveDesc: 'Sở hữu Tiện Ích: nhân x12 thay x10',
    passiveIcon: '⚡',
    skills: [
      { id: 'musk_rocket', name: 'Tên Lửa Starship', desc: 'Bay thẳng tới ô Cơ Hội hoặc Khí Vận ngẫu nhiên', icon: '🚀', type: 'utility', cooldown: 4, vfx: 'fist' },
      { id: 'musk_doge', name: 'Doge Pump', desc: 'Đẩy giá đất bạn đang đứng lên gấp đôi trong 1 lượt', icon: '🐕', type: 'utility', cooldown: 5, vfx: 'beam' },
      { id: 'musk_shield', name: 'Bảo Hộ CyberShield', desc: 'Tạo giáp chắn chặn 100% tiền phạt hoặc tiền thuê kế tiếp', icon: '🛡️', type: 'defense', cooldown: 4, vfx: 'shield' }
    ]
  },
  {
    id: 'son_tung',
    name: 'Sơn Tùng MTP',
    emoji: '🎵',
    title: 'Siêu Sao Âm Nhạc',
    color: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #831843 0%, #ec4899 50%, #f9a8d4 100%)',
    avatarUrl: '/characters/son_tung.png',
    passiveName: 'Superstar',
    passiveDesc: 'Tự động thoát tù lần đầu tiên',
    passiveIcon: '⭐',
    skills: [
      { id: 'tung_sky', name: 'Sky Tour Concert', desc: 'Mỗi người chơi phải mua vé xem ca nhạc trị giá $60 nộp cho bạn', icon: '🎤', type: 'attack', cooldown: 3, vfx: 'beam' },
      { id: 'tung_fade', name: 'Chạy Ngay Đi', desc: 'Nhảy thẳng ra khỏi tù hoặc di chuyển ngẫu nhiên 5 bước', icon: '🏃', type: 'utility', cooldown: 4, vfx: 'fist' },
      { id: 'tung_shield', name: 'Cơn Mưa Ngang Qua', desc: 'Tạo màng nước chắn bảo vệ bản thân khỏi mọi sự cố thuê đất trong lượt này', icon: '🌧️', type: 'defense', cooldown: 4, vfx: 'shield' }
    ]
  },
  {
    id: 'jack_ma',
    name: 'Jack Ma',
    emoji: '🏆',
    title: 'Huyền Thoại Thương Mại',
    color: '#f97316',
    bgGradient: 'linear-gradient(135deg, #7c2d12 0%, #f97316 50%, #fed7aa 100%)',
    avatarUrl: '/characters/jack_ma.png',
    passiveName: 'Alibaba',
    passiveDesc: 'Mua BĐS từ Ngân hàng giảm 10%',
    passiveIcon: '🛒',
    skills: [
      { id: 'ma_invest', name: 'Đầu Tư Mạo Hiểm', desc: 'Dùng $100 đặt cược nhận ngẫu nhiên từ $0 đến $300 từ cổ phiếu', icon: '📈', type: 'utility', cooldown: 3, vfx: 'beam' },
      { id: 'ma_influence', name: 'Ngoại Giao Alibaba', desc: 'Ép đối thủ phải giảm 30% tiền thuê đất khi bạn đi vào', icon: '🤝', type: 'defense', cooldown: 4, vfx: 'shield' },
      { id: 'ma_strike', name: 'Độc Quyền Thương Mại', desc: 'Tấn công làm đóng băng 1 ô đất bất kỳ của đối thủ trong 1 vòng', icon: '🧊', type: 'attack', cooldown: 5, vfx: 'fist' }
    ]
  },
];

export const getCharacterById = (id: string): CharacterDef => {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
};

export const DEFAULT_CHARACTER_ID = 'huan_hoa_hong';
