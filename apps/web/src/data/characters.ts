/**
 * Hệ thống nhân vật nổi tiếng - Cờ Tỷ Phú Online
 * Mỗi nhân vật có avatar thực, 1 skill passive + 1 skill active (1 lần/trận)
 */

export interface CharacterDef {
  id: string;
  name: string;
  emoji: string;
  title: string;
  color: string;
  bgGradient: string;
  avatarUrl: string;       // URL tới ảnh avatar trong /public/characters/
  passiveName: string;
  passiveDesc: string;
  passiveIcon: string;
  activeName: string;
  activeDesc: string;
  activeIcon: string;
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
    activeName: 'Lật Kèo',
    activeDesc: 'Đổ lại xúc xắc 1 lần trong trận',
    activeIcon: '🎲',
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
    activeName: 'All-in',
    activeDesc: 'Mua đất với giá giảm 25% (1 lần)',
    activeIcon: '🃏',
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
    activeName: 'Art of the Deal',
    activeDesc: 'Thu gấp 3 tiền thuê đất 1 lượt',
    activeIcon: '📜',
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
    activeName: 'Cải Cách Thuế',
    activeDesc: 'Miễn phí 1 lần nộp thuế',
    activeIcon: '📋',
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
    activeName: 'Donate Storm',
    activeDesc: 'Lấy $100 từ mỗi người chơi khác',
    activeIcon: '💸',
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
    activeName: 'SpaceX Launch',
    activeDesc: 'Dịch chuyển tới ô BĐS trống bất kỳ',
    activeIcon: '🛸',
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
    activeName: 'Sky Tour',
    activeDesc: 'Bay thẳng tới GO và nhận $400',
    activeIcon: '✈️',
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
    activeName: 'Đầu Tư Mạo Hiểm',
    activeDesc: 'Thu gấp đôi tiền thuê toàn bộ đất trong 2 lượt',
    activeIcon: '📈',
  },
];

export const getCharacterById = (id: string): CharacterDef => {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
};

export const DEFAULT_CHARACTER_ID = 'huan_hoa_hong';
