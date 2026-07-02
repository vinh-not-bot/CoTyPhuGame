import React from 'react';
import type { Tile as TileType, Player } from '../types';
import { PlayerToken } from './PlayerToken';

interface TileProps {
  tile: TileType;
  playersOnTile: Player[];
  onClick?: () => void;
  isSelectable?: boolean;
  is3D?: boolean;
  tilt?: number;
  rotation?: number;
  owner?: Player;
  predictionRolls?: number[]; // Thêm danh sách các số xúc xắc có thể đi vào ô này
}

const colorMap: Record<string, string> = {
  brown: 'bg-[#8B5A2B]',      // Classic Brown
  sky: 'bg-[#87CEEB]',        // Classic Light Blue / Sky
  pink: 'bg-[#FF69B4]',       // Pink
  orange: 'bg-[#FF8C00]',     // Orange
  red: 'bg-[#FF0000]',        // Red
  yellow: 'bg-[#FFD700]',     // Yellow
  green: 'bg-[#008000]',      // Green
  navy: 'bg-[#000080]',       // Navy
};

export const Tile: React.FC<TileProps> = ({ 
  tile, 
  playersOnTile, 
  onClick, 
  isSelectable,
  is3D = false,
  tilt = 45,
  rotation = -30,
  owner,
  predictionRolls = []
}) => {
  const isCorner = tile.type === 'go' || tile.type === 'jail' || tile.type === 'freeparking' || tile.type === 'gotojail';
  
  // Vẽ nhà hoặc khách sạn bằng khối hộp 3D lập thể hoặc chấm 2D phẳng
  const renderHouses3D = () => {
    if (tile.type !== 'property' || tile.houses === 0) return null;
    
    if (!is3D) {
      if (tile.houses === 5) {
        return (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-red-600 rounded-sm border border-red-800" title="Khách Sạn" />
        );
      }
      return (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-0.5 justify-center">
          {Array.from({ length: tile.houses }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 bg-green-500 rounded-sm border border-green-700" title="Nhà" />
          ))}
        </div>
      );
    }

    // Chế độ 3D: Dựng đứng khối lập thể 3D thực thụ
    const isHotel = tile.houses === 5;
    const houseCount = isHotel ? 1 : tile.houses;

    return (
      <div 
        style={{ transformStyle: 'preserve-3d' }}
        className="absolute top-0.5 left-1/2 -translate-x-1/2 flex gap-1 justify-center z-15"
      >
        {Array.from({ length: houseCount }).map((_, i) => {
          const size = isHotel ? { w: 10, h: 10, d: 14 } : { w: 5, h: 5, d: 7 };
          const colorClass = isHotel 
            ? { top: 'bg-rose-500', front: 'bg-rose-600', side: 'bg-rose-700', border: 'border-rose-800' }
            : { top: 'bg-emerald-400', front: 'bg-emerald-500', side: 'bg-emerald-600', border: 'border-emerald-700' };

          return (
            <div 
              key={i} 
              className="relative transition-transform duration-300 shadow-lg"
              style={{
                width: `${size.w}px`,
                height: `${size.h}px`,
                transformStyle: 'preserve-3d',
                transform: 'translateZ(1px)',
              }}
            >
              {/* Mặt trên */}
              <div 
                className={`absolute inset-0 ${colorClass.top} border ${colorClass.border}`} 
                style={{ transform: `translateZ(${size.d}px)` }}
              />
              {/* Mặt trước */}
              <div 
                className={`absolute inset-0 ${colorClass.front} border ${colorClass.border}`} 
                style={{
                  height: `${size.d}px`,
                  transform: 'rotateX(-90deg)',
                  transformOrigin: 'bottom',
                  bottom: 0,
                }}
              />
              {/* Mặt sau */}
              <div 
                className={`absolute inset-0 ${colorClass.front} border ${colorClass.border}`} 
                style={{
                  height: `${size.d}px`,
                  transform: 'rotateX(90deg)',
                  transformOrigin: 'top',
                  top: 0,
                }}
              />
              {/* Mặt trái */}
              <div 
                className={`absolute inset-0 ${colorClass.side} border ${colorClass.border}`} 
                style={{
                  width: `${size.d}px`,
                  transform: 'rotateY(-90deg)',
                  transformOrigin: 'left',
                  left: 0,
                }}
              />
              {/* Mặt phải */}
              <div 
                className={`absolute inset-0 ${colorClass.side} border ${colorClass.border}`} 
                style={{
                  width: `${size.d}px`,
                  transform: 'rotateY(90deg)',
                  transformOrigin: 'right',
                  right: 0,
                }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // Special designs for corners
  const getCornerEmoji = () => {
    if (tile.type === 'go') return '🏁';
    if (tile.type === 'jail') return '🔒';
    if (tile.type === 'freeparking') return '🚗';
    if (tile.type === 'gotojail') return '🚓';
    return null;
  };

  const cornerEmoji = getCornerEmoji();

  return (
    <div
      onClick={onClick}
      className={`relative border-2 flex flex-col justify-between p-1 bg-white select-none text-center cursor-pointer transition-all duration-150 shadow-sm
        ${isCorner ? 'aspect-square justify-center bg-slate-50/90' : 'aspect-[3/4]'}
        ${isSelectable ? 'ring-2 ring-emerald-500 hover:bg-slate-50' : 'hover:bg-slate-50/55'}
        ${tile.mortgaged ? 'opacity-60 grayscale' : ''}
      `}
      style={{
        ...(is3D ? { transformStyle: 'preserve-3d' } : {}),
        borderColor: tile.ownerId && owner ? owner.avatarColor : '#e2e8f0',
      }}
    >
      {/* Landing Prediction Badge (Hiển thị dự báo số điểm cần xúc xắc) */}
      {predictionRolls.length > 0 && (
        <div 
          style={is3D ? { transform: `rotateX(${-tilt}deg) rotateZ(${-rotation}deg) translateZ(18px)`, transformStyle: 'preserve-3d' } : {}}
          className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-amber-500 to-orange-500 border border-white text-slate-950 text-[7px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-lg z-40 animate-pulse"
          title={`Tung được ${predictionRolls.join(', ')} để đi vào ô này`}
        >
          {predictionRolls.join('/')}
        </div>
      )}

      {/* Property color bar */}
      {tile.colorGroup && !isCorner && (
        <div className={`w-full h-3.5 ${colorMap[tile.colorGroup]} rounded-sm mb-0.5 relative shadow-sm border border-black/15`}>
          {renderHouses3D()}
        </div>
      )}

      {/* Tile Content */}
      <div 
        style={is3D ? { transform: 'translateZ(1px)' } : {}}
        className="flex-1 flex flex-col items-center justify-center gap-0.5"
      >
        {isCorner && cornerEmoji && (
          <span className="text-sm md:text-base leading-none">{cornerEmoji}</span>
        )}
        <span className={`font-black tracking-tight leading-tight uppercase
          ${isCorner 
            ? 'text-[8px] md:text-[9px] text-slate-800 mt-0.5' 
            : 'text-[7.5px] md:text-[8.5px] text-slate-700 font-bold'
          }`}>
          {tile.name}
        </span>
      </div>

      {/* Owner & Price Info */}
      {!isCorner && (
        <div 
          style={is3D ? { transform: 'translateZ(1.5px)' } : {}}
          className="mt-0.5 text-[8px] font-extrabold flex flex-col items-center"
        >
          {tile.ownerId && owner ? (
            <span
              className="px-1 py-0.2 rounded text-[6px] text-white font-black uppercase tracking-wider shadow-sm truncate max-w-[48px]"
              style={{ backgroundColor: tile.mortgaged ? '#64748b' : owner.avatarColor }}
              title={tile.mortgaged ? `Thế chấp (Chủ: ${owner.name})` : `Chủ sở hữu: ${owner.name}`}
            >
              {tile.mortgaged ? 'Thế chấp' : owner.name.substring(0, 5)}
            </span>
          ) : (
            tile.price > 0 && <span className="text-emerald-700">${tile.price}</span>
          )}
        </div>
      )}

      {/* Players on Tile (dựng đứng cờ ở chế độ 3D) */}
      <div 
        style={is3D ? { transformStyle: 'preserve-3d' } : {}}
        className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex flex-wrap gap-1 justify-center w-full px-0.5 z-10"
      >
        {playersOnTile.map((p, idx) => (
          <PlayerToken 
            key={p.userId} 
            name={p.name} 
            color={p.avatarColor} 
            index={idx} 
            is3D={is3D}
            tilt={tilt}
            rotation={rotation}
            characterId={p.characterId}
          />
        ))}
      </div>
    </div>
  );
};
