import React from 'react';
import type { Room } from '../types';
import { getCharacterById } from '../data/characters';

interface LobbyRoomProps {
  room: Room;
  players: { userId: string; display_name: string; avatar_color: string; is_host: boolean; character_id?: string }[];
  currentUserId: string;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const LobbyRoom: React.FC<LobbyRoomProps> = ({
  room,
  players,
  currentUserId,
  onStartGame,
  onLeaveRoom,
}) => {
  const isHost = room.host_id === currentUserId;
  const canStart = players.length >= 2;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.room_code);
    alert('Đã sao chép mã phòng: ' + room.room_code);
  };

  return (
    <div className="glass-panel border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl mx-auto flex flex-col gap-6 text-center animate-fade-in relative z-10">
      <div>
        <h2 className="text-2xl font-black text-gold-400 shimmer-text">Phòng Chờ Trận Đấu</h2>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trạng thái:</span>
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider
            ${room.is_public ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
            {room.is_public ? 'Công khai' : 'Riêng tư'}
          </span>
        </div>
      </div>

      <div className="bg-[#0f172a]/95 border border-white/5 p-4 rounded-2xl flex flex-col gap-2 items-center shadow-inner">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">MÃ PHÒNG</span>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-white tracking-[0.25em]">{room.room_code}</span>
          <button
            onClick={handleCopyCode}
            className="px-3 py-1.5 bg-gold-500 hover:bg-gold-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow transition-all duration-300"
          >
            Sao chép
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 align-start text-left">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">
          Thành Viên ({players.length}/{room.settings.maxPlayers})
        </span>
        <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
          {players.map((p) => {
            const char = getCharacterById(p.character_id || 'huan_hoa_hong');
            return (
              <div
                key={p.userId}
                className="flex justify-between items-center bg-[#0f172a]/95 px-3 py-2.5 rounded-xl border border-white/5 text-xs transition-all duration-300 hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src={char.avatarUrl} 
                      alt={char.name} 
                      className="w-10 h-10 rounded-full border-2 object-cover shadow"
                      style={{ borderColor: char.color }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const sibling = (e.target as HTMLElement).nextElementSibling;
                        if (sibling) (sibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                    <div 
                      className="hidden w-10 h-10 rounded-full border border-white/20 items-center justify-center text-xl bg-slate-800"
                      style={{ display: 'none' }}
                    >
                      {char.emoji}
                    </div>
                    {/* Small colored status dot */}
                    <div 
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f172a]"
                      style={{ backgroundColor: p.avatar_color }}
                    />
                  </div>
                  <div>
                    <span className="font-black text-slate-100 flex items-center gap-1">
                      <span>{p.display_name}</span>
                      {p.userId === currentUserId && <span className="text-[9px] text-slate-400 font-normal">(Tôi)</span>}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block">
                      {char.emoji} {char.name} ({char.title})
                    </span>
                  </div>
                </div>
                {p.is_host && (
                  <span className="text-[8px] bg-gold-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Chủ phòng
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 justify-center mt-3 border-t border-white/5 pt-5">
        <button
          onClick={onLeaveRoom}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white font-extrabold text-xs rounded-xl border border-white/5 transition-all duration-300"
        >
          Rời Phòng
        </button>

        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className={`px-6 py-2.5 rounded-xl text-white font-black text-xs active:scale-95 transition-all duration-300 shadow-lg btn-pulse-glow
              ${canStart
                ? 'bg-emerald-600 hover:bg-emerald-500 hover:scale-102 cursor-pointer'
                : 'bg-slate-700 opacity-50 cursor-not-allowed'
              }`}
          >
            Bắt Đầu Trò Chơi
          </button>
        ) : (
          <div className="flex items-center justify-center text-[10px] text-slate-400 font-extrabold uppercase tracking-wider animate-pulse">
            Đang đợi chủ phòng bắt đầu trận đấu...
          </div>
        )}
      </div>

      {isHost && !canStart && (
        <span className="text-[10px] text-red-400 font-bold">Trò chơi cần tối thiểu 2 người để bắt đầu.</span>
      )}
    </div>
  );
};
