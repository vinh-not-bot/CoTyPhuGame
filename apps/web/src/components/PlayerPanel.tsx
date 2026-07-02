import React from 'react';
import type { Player, Tile } from '../types';
import { getCharacterById } from '../data/characters';

interface PlayerPanelProps {
  players: Player[];
  activePlayerIndex: number;
  currentUserId: string;
  board: Tile[];
}

const colorGroupHex: Record<string, string> = {
  brown: '#78350f',
  sky: '#0ea5e9',
  pink: '#ec4899',
  orange: '#f97316',
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  navy: '#1e3a8a',
};

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  players,
  activePlayerIndex,
  currentUserId,
  board,
}) => {
  return (
    <div className="flex flex-col gap-2 w-full max-w-[280px] glass-panel border border-white/10 rounded-2xl p-4 shadow-xl select-none">
      <h3 className="text-gold-400 font-black border-b border-white/5 pb-2 text-sm shimmer-text uppercase tracking-wider">
        Danh Sách Tỷ Phú
      </h3>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px] pr-1">
        {players.map((player, idx) => {
          const isActive = idx === activePlayerIndex;
          const isMe = player.userId === currentUserId;
          const ownedProperties = board.filter((tile) => tile.ownerId === player.userId);
          const char = getCharacterById(player.characterId || 'huan_hoa_hong');

          return (
            <div
              key={player.userId}
              className={`p-2.5 rounded-xl border transition-all duration-300 flex flex-col gap-2
                ${isActive
                  ? 'bg-white/10 border-gold-400 shadow-[0_0_12px_rgba(220,182,37,0.3)] character-card-glow'
                  : 'bg-[#0f172a]/95 border-white/5'
                }
                ${player.isBankrupt ? 'opacity-40 grayscale' : ''}
              `}
              style={{ '--glow-color': char.color } as React.CSSProperties}
            >
              {/* Header: Avatar, Name, Cash */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <img 
                      src={char.avatarUrl} 
                      alt={char.name} 
                      className="w-8 h-8 rounded-full border object-cover shadow"
                      style={{ borderColor: char.color }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                        const sibling = (e.target as HTMLElement).nextElementSibling;
                        if (sibling) (sibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                    <div 
                      className="hidden w-8 h-8 rounded-full border border-white/20 items-center justify-center text-sm bg-slate-800"
                      style={{ display: 'none' }}
                    >
                      {char.emoji}
                    </div>
                    {/* Small user avatarColor indicator dot */}
                    <div 
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0f172a]"
                      style={{ backgroundColor: player.avatarColor }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-xs font-black truncate max-w-[100px] ${isMe ? 'text-gold-300 animate-pulse' : 'text-slate-100'}`}>
                      {player.name} {isMe && '(Tôi)'}
                    </span>
                    <span className="text-[8px] text-slate-400 font-extrabold uppercase">
                      {char.emoji} {char.name}
                    </span>
                  </div>
                </div>

                {player.isBankrupt ? (
                  <span className="text-[8px] bg-red-950/60 border border-red-500/80 text-red-100 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    Phá sản
                  </span>
                ) : (
                  <span className="text-xs font-black text-green-400">${player.cash}</span>
                )}
              </div>

              {/* Body: Stats, Jail Status, Passive skill hint */}
              {!player.isBankrupt && (
                <div className="text-[10px] text-slate-400 flex flex-col gap-1 border-t border-white/5 pt-1.5">
                  <div className="flex justify-between items-center">
                    <span>Ô: <span className="font-extrabold text-slate-300">{player.position}</span> - {board[player.position]?.name}</span>
                    {player.inJail && (
                      <span className="text-red-400 font-black bg-red-950/40 border border-red-500/30 px-1.5 py-0.2 rounded uppercase text-[7px] tracking-wide animate-pulse">
                        Trong Tù ({player.jailTurns}/3)
                      </span>
                    )}
                  </div>

                  {/* Passive skill indicator */}
                  <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
                    <span>{char.passiveIcon}</span>
                    <span className="uppercase tracking-wide text-slate-300">{char.passiveName}:</span>
                    <span className="font-medium truncate max-w-[150px]">{char.passiveDesc}</span>
                  </div>

                  {/* Properties list */}
                  {ownedProperties.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 border-t border-white/5 pt-1.5">
                      {ownedProperties.map((prop) => {
                        const bgCol = prop.colorGroup ? colorGroupHex[prop.colorGroup] : '#475569';
                        return (
                          <div
                            key={prop.index}
                            style={{ backgroundColor: bgCol }}
                            className="px-1.5 py-0.5 rounded text-[7px] font-extrabold text-white flex items-center gap-1 select-none shadow hover:brightness-110 transition-all cursor-default"
                            title={`${prop.name} ${prop.houses > 0 ? `(${prop.houses === 5 ? 'KS' : `${prop.houses} nhà`})` : ''}`}
                          >
                            <span>{prop.name.substring(0, 4)}</span>
                            {prop.houses > 0 && (
                              <span className="bg-black/35 px-0.8 rounded text-[6px] font-black">
                                {prop.houses === 5 ? 'H' : prop.houses}
                              </span>
                            )}
                            {prop.mortgaged && (
                              <span className="text-[6px] bg-red-950/80 px-0.8 rounded text-slate-300 font-black border border-red-500/25">
                                M
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
