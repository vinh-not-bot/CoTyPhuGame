import React from 'react';
import { motion } from 'framer-motion';
import { getCharacterById } from '../data/characters';

interface PlayerTokenProps {
  name: string;
  color: string;
  index: number;
  is3D?: boolean;
  tilt?: number;
  rotation?: number;
  characterId?: string;
}

export const PlayerToken: React.FC<PlayerTokenProps> = ({ 
  name, 
  color, 
  index,
  is3D = false,
  tilt = 45,
  rotation = -30,
  characterId = 'huan_hoa_hong'
}) => {
  const char = getCharacterById(characterId);

  // Tính toán vị trí lệch để các người chơi không đứng trùng khớp khít lên nhau
  const offset = {
    x: (index % 2) * 10 - 5,
    y: Math.floor(index / 2) * 10 - 5,
  };

  // Áp dụng transform dựng thẳng đứng 3D (Billboarded)
  const transformStyle = is3D ? {
    transform: `translate(${offset.x}px, ${offset.y}px) rotateX(${-tilt}deg) rotateZ(${-rotation}deg)`,
    transformStyle: 'preserve-3d' as const,
  } : {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
  };

  return (
    <motion.div
      layoutId={`token-${name}`} // Framer motion tự động trượt mượt mà khi thay đổi ô cờ
      layout
      transition={{ type: 'spring', stiffness: 95, damping: 15 }}
      className={`relative z-30 flex items-center justify-center transition-all duration-300
        ${is3D ? 'w-8 h-14' : 'w-4 h-4 rounded-full border border-white flex items-center justify-center text-[7px] font-black text-white shadow-md'}`}
      style={{
        ...transformStyle,
        ...(is3D ? {} : { backgroundColor: color, borderColor: '#ffffff' }),
      }}
      title={`${name} (${char.name})`}
    >
      {is3D ? (
        /* ========================================== */
        /* NGƯỜI QUE 3D THỰC THỤ (3D STICKMAN FIGURINE) */
        /* ========================================== */
        <div 
          style={{ transformStyle: 'preserve-3d' }}
          className="w-full h-full relative flex flex-col items-center justify-end"
        >
          {/* 1. Đầu 3D (Head Box) */}
          <div 
            style={{ 
              transform: 'translateY(-18px) translateZ(10px)',
              transformStyle: 'preserve-3d',
              borderColor: color,
            }}
            className="absolute top-0 w-5 h-5 rounded-full border-2 bg-slate-900 overflow-hidden shadow-[0_0_8px_rgba(255,255,255,0.4)] flex items-center justify-center"
          >
            <img 
              src={char.avatarUrl} 
              alt={char.name} 
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                const sibling = (e.target as HTMLElement).nextElementSibling;
                if (sibling) (sibling as HTMLElement).style.display = 'flex';
              }}
            />
            <div className="hidden text-[10px] items-center justify-center">{char.emoji}</div>
          </div>

          {/* 2. Thân người que (Torso) */}
          <div 
            style={{ 
              transform: 'translateY(-8px) translateZ(4px)',
              backgroundColor: color,
            }}
            className="absolute w-1 h-5 rounded-full shadow-inner"
          />

          {/* 3. Tay trái (Left Arm) */}
          <div 
            style={{ 
              transform: 'translateY(-8px) translateX(-4px) rotateZ(20deg) translateZ(4px)',
              transformOrigin: 'top center',
            }}
            className="absolute w-0.8 h-4.5 bg-slate-300 rounded-full animate-walk-left"
          />

          {/* 4. Tay phải (Right Arm) */}
          <div 
            style={{ 
              transform: 'translateY(-8px) translateX(4px) rotateZ(-20deg) translateZ(4px)',
              transformOrigin: 'top center',
            }}
            className="absolute w-0.8 h-4.5 bg-slate-300 rounded-full animate-walk-right"
          />

          {/* 5. Chân trái (Left Leg) */}
          <div 
            style={{ 
              transform: 'translateY(1px) translateX(-2.5px) translateZ(2px)',
              transformOrigin: 'top center',
            }}
            className="absolute w-0.8 h-5 bg-slate-400 rounded-full animate-walk-left"
          />

          {/* 6. Chân phải (Right Leg) */}
          <div 
            style={{ 
              transform: 'translateY(1px) translateX(2.5px) translateZ(2px)',
              transformOrigin: 'top center',
            }}
            className="absolute w-0.8 h-5 bg-slate-400 rounded-full animate-walk-right"
          />

          {/* 7. Đế đứng 3D hình tròn phát sáng dưới chân (Pawn Pedestal) */}
          <div 
            className="absolute -bottom-1 w-6 h-1.5 rounded-full border border-white/20 flex items-center justify-center shadow-lg"
            style={{ 
              transform: 'rotateX(90deg) translateZ(-2px)',
              backgroundColor: `${color}cc`,
              boxShadow: `0 0 10px ${color}, inset 0 0 4px #ffffff`,
            }}
          />

          {/* Nhãn tên viết tắt lơ lửng trên đầu người que */}
          <div 
            style={{ transform: 'translateY(-30px) translateZ(12px)' }}
            className="absolute bg-black/80 border border-white/10 px-1 py-0.2 rounded text-[5px] font-black text-white uppercase tracking-wider text-center pointer-events-none truncate max-w-[28px]"
          >
            {name.substring(0, 4)}
          </div>
        </div>
      ) : (
        /* Giao diện 2D hình tròn đơn giản */
        <span className="leading-none">{name.substring(0, 1).toUpperCase()}</span>
      )}
    </motion.div>
  );
};
