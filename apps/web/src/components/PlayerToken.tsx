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

  // Tính độ dời nhỏ để tránh các quân cờ đè khít lên nhau
  const offset = {
    x: (index % 2) * 12 - 6,
    y: Math.floor(index / 2) * 12 - 6,
  };

  // Cấu hình transform đứng thẳng 3D và bóng đổ dưới chân
  const transformStyle = is3D ? {
    transform: `translate(${offset.x}px, ${offset.y}px) rotateX(${-tilt}deg) rotateZ(${-rotation}deg) translateZ(16px)`,
    transformStyle: 'preserve-3d' as const,
  } : {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
  };

  return (
    <motion.div
      layoutId={`token-${name}`} // Framer motion sử dụng layoutId trùng khớp để tạo chuyển động trượt mượt mà
      layout
      transition={{ type: 'spring', stiffness: 90, damping: 14 }}
      className={`relative z-30 flex items-center justify-center transition-all duration-300
        ${is3D 
          ? 'w-7 h-9 rounded-md border-2 shadow-2xl bg-slate-900/90' 
          : 'w-4.5 h-4.5 rounded-full border border-white flex items-center justify-center text-[8px] font-black text-white shadow-md'
        }`}
      style={{
        ...transformStyle,
        borderColor: color,
        boxShadow: is3D ? `0 10px 15px rgba(0,0,0,0.5), 0 0 10px ${color}80` : 'none',
      }}
      title={`${name} (${char.name})`}
    >
      {is3D ? (
        /* Giao diện Pawn 3D đứng thẳng của Nhân Vật */
        <div className="w-full h-full relative overflow-hidden rounded-sm flex flex-col justify-between">
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
          <div 
            className="hidden w-full h-full items-center justify-center text-base bg-slate-800"
            style={{ display: 'none' }}
          >
            {char.emoji}
          </div>
          
          {/* Tên viết tắt dưới chân Pawn */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/65 text-[6px] font-black text-white text-center py-0.2 tracking-tighter truncate">
            {name.substring(0, 4)}
          </div>
          
          {/* Đế cờ 3D bóng đổ dưới chân */}
          <div 
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-black/60 blur-[1px] rounded-full" 
            style={{ transform: 'translateZ(-1px)' }}
          />
        </div>
      ) : (
        /* Giao diện 2D hình tròn đơn giản */
        <span>{name.substring(0, 1).toUpperCase()}</span>
      )}
    </motion.div>
  );
};
