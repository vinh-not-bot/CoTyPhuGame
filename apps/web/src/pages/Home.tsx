import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { CharacterSelect } from '../components/CharacterSelect';

export const Home: React.FC = () => {
  const {
    userName,
    setUserName,
    userAvatarColor,
    setUserAvatarColor,
    selectedCharacter,
    setSelectedCharacter,
    createRoom,
    joinRoom,
    quickJoin,
    error,
    setError,
    loading,
  } = useGameStore();

  const [inputName, setInputName] = useState(userName);
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [startMoney, setStartMoney] = useState(1500);
  const [avatarColor, setAvatarColor] = useState(userAvatarColor);
  const [isPublic, setIsPublic] = useState(true); // Default to public room

  const colors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Orange/Yellow
    '#8b5cf6', // Purple
    '#ec4899', // Pink
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) {
      setError('Vui lòng nhập tên của bạn');
      return;
    }
    setUserName(inputName.trim());
    setUserAvatarColor(avatarColor);
    await createRoom(maxPlayers, startMoney, isPublic);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) {
      setError('Vui lòng nhập tên của bạn');
      return;
    }
    if (!inputRoomCode.trim()) {
      setError('Vui lòng nhập mã phòng');
      return;
    }
    setUserName(inputName.trim());
    setUserAvatarColor(avatarColor);
    await joinRoom(inputRoomCode.trim());
  };

  const handleQuickJoin = async () => {
    if (!inputName.trim()) {
      setError('Vui lòng nhập tên của bạn');
      return;
    }
    setUserName(inputName.trim());
    setUserAvatarColor(avatarColor);
    await quickJoin();
  };

  return (
    <div className="min-h-screen neon-glow-bg select-none text-white relative flex flex-col justify-between py-10 px-4 md:px-10">
      {/* Decorative Particle Overlay */}
      <div className="particle-field" />
      <div className="noise-overlay" />

      {/* Header Title */}
      <div className="text-center mt-4 animate-fade-in relative z-10">
        <h1 className="text-4xl md:text-6xl font-black tracking-wider shimmer-text drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          CỜ TỶ PHÚ
        </h1>
        <span className="text-xs md:text-sm text-slate-400 font-extrabold uppercase tracking-[0.25em] block mt-1.5">
          ⭐ MULTIPLAYER MONOPOLY ONLINE ⭐
        </span>
      </div>

      {/* Main Glass Panel */}
      <div className="glass-panel max-w-4xl w-full mx-auto rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 border border-white/10 my-8">
        {/* Error notification */}
        {error && (
          <div className="mb-6 bg-red-900/60 border border-red-500/80 text-red-100 p-3 rounded-xl text-xs text-center font-bold shadow-lg animate-pulse flex justify-between items-center">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setError(null)} className="hover:text-white ml-2 text-slate-300">✕</button>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {/* Section 1: User Profile Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Display Name Input */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-300 font-extrabold text-xs uppercase tracking-wider">Tên hiển thị:</label>
              <input
                type="text"
                maxLength={20}
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="bg-[#0f172a]/95 text-white border border-white/10 p-3 rounded-xl w-full font-bold focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all shadow-inner text-sm"
                placeholder="Nhập tên của bạn..."
              />
            </div>

            {/* Avatar Color Choice */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-slate-300 font-extrabold text-xs uppercase tracking-wider">Màu quân cờ:</label>
              <div className="flex gap-3 justify-start md:justify-center items-center py-2 h-full">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-8 h-8 rounded-full border-2 transition-all duration-300 active:scale-90 shadow-md hover:scale-115
                      ${avatarColor === c ? 'border-white ring-4 ring-gold-400/50' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Character Selection */}
          <div className="flex flex-col gap-2 border-t border-white/5 pt-6">
            <div className="flex justify-between items-center">
              <label className="text-slate-300 font-extrabold text-xs uppercase tracking-wider">
                Chọn Nhân Vật (Famous Characters):
              </label>
              <span className="text-[10px] text-gold-400 font-bold">Mỗi nhân vật có skill riêng</span>
            </div>
            <CharacterSelect
              selectedCharacterId={selectedCharacter}
              onSelect={setSelectedCharacter}
            />
          </div>

          {/* Section 3: Game Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white/5 pt-6 mt-2">
            {/* Quick Match Pillar */}
            <div className="flex flex-col justify-center items-center p-4 bg-white/5 border border-white/5 rounded-2xl relative overflow-hidden group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
              <div className="relative flex flex-col items-center text-center gap-3">
                <span className="text-[10px] text-gold-400 font-extrabold tracking-widest uppercase">
                  MATCHMAKING
                </span>
                <h3 className="text-lg font-black text-white">Chơi Tự Do</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Tìm phòng công khai ngẫu nhiên. Nếu không có phòng, tự động tạo mới!
                </p>
                <button
                  type="button"
                  onClick={handleQuickJoin}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 rounded-xl text-slate-950 font-black text-sm active:scale-95 transition-all shadow-lg btn-pulse-glow hover:scale-102"
                >
                  {loading ? 'Đang tìm...' : '🎲 CHƠI NHANH'}
                </button>
              </div>
            </div>

            {/* Custom Room Pillar */}
            <form onSubmit={handleCreate} className="flex flex-col gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl">
              <span className="text-[10px] text-gold-400 font-extrabold tracking-widest uppercase text-center">
                TẠO PHÒNG MỚI
              </span>
              
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Quyền riêng tư:</label>
                  <div className="flex gap-1.5 bg-[#0f172a] p-1 rounded-lg border border-white/5">
                    <button
                      type="button"
                      onClick={() => setIsPublic(true)}
                      className={`flex-1 py-1 rounded text-center font-bold ${isPublic ? 'bg-gold-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      Công khai
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPublic(false)}
                      className={`flex-1 py-1 rounded text-center font-bold ${!isPublic ? 'bg-gold-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      Riêng tư
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-bold">Số người tối đa:</label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                    className="bg-[#0f172a] text-white border border-white/10 p-2 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-gold-500 text-xs h-full"
                  >
                    <option value={2}>2 Người</option>
                    <option value={3}>3 Người</option>
                    <option value={4}>4 Người</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-[10px]">
                <label className="text-slate-400 font-bold">Vốn xuất phát ($):</label>
                <input
                  type="number"
                  min={500}
                  max={5000}
                  value={startMoney}
                  onChange={(e) => setStartMoney(parseInt(e.target.value) || 1500)}
                  className="bg-[#0f172a] text-white border border-white/10 p-2 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-gold-500 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-black text-xs active:scale-95 transition-all shadow-md hover:scale-102"
              >
                {loading ? 'Đang tạo...' : 'Tạo phòng'}
              </button>
            </form>

            {/* Join Room Pillar */}
            <form onSubmit={handleJoin} className="flex flex-col gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl justify-between">
              <div className="flex flex-col gap-3">
                <span className="text-[10px] text-gold-400 font-extrabold tracking-widest uppercase text-center">
                  VÀO PHÒNG CÓ SẴN
                </span>
                
                <div className="flex flex-col gap-1 text-[10px]">
                  <label className="text-slate-400 font-bold">Nhập mã phòng (6 ký tự):</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
                    className="bg-[#0f172a] text-white border border-white/10 p-3 rounded-lg text-center tracking-[0.2em] font-black uppercase placeholder-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-gold-500"
                    placeholder="ABCDEF"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-black text-xs active:scale-95 transition-all shadow-md hover:scale-102"
              >
                {loading ? 'Đang vào...' : 'Vào phòng'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[10px] text-slate-500 font-bold tracking-wider relative z-10">
        CỜ TỶ PHÚ ONLINE - VINH PRO EDITION &copy; 2026
      </div>
    </div>
  );
};
