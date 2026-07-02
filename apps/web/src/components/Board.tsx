import React, { useState, useEffect, useRef } from 'react';
import type { Tile as TileType, Player } from '../types';
import { Tile } from './Tile';

interface BoardProps {
  board: TileType[];
  players: Player[];
  onTileClick?: (index: number) => void;
  selectedTileIndex?: number | null;
  selectableTileIndices?: number[];
  onTileHover?: (index: number | null) => void;
  activePlayerIndex?: number;
  rollPredictions?: Record<number, number[]>;
  children?: React.ReactNode;
}

export const getTileGridPosition = (index: number) => {
  if (index === 0) return { gridRow: 11, gridColumn: 11 };
  if (index > 0 && index < 10) return { gridRow: 11, gridColumn: 11 - index };
  if (index === 10) return { gridRow: 11, gridColumn: 1 };
  if (index > 10 && index < 20) return { gridRow: 11 - (index - 10), gridColumn: 1 };
  if (index === 20) return { gridRow: 1, gridColumn: 1 };
  if (index > 20 && index < 30) return { gridRow: 1, gridColumn: 1 + (index - 20) };
  if (index === 30) return { gridRow: 1, gridColumn: 11 };
  if (index > 30 && index < 40) return { gridRow: 1 + (index - 30), gridColumn: 11 };
  return { gridRow: 1, gridColumn: 1 };
};

const getTilePercentPosition = (index: number) => {
  const pos = getTileGridPosition(index);
  const x = ((pos.gridColumn - 0.5) / 11) * 100;
  const y = ((pos.gridRow - 0.5) / 11) * 100;
  return `${x}% ${y}%`;
};

type ViewMode = '2D' | '3D' | '3P' | '1P';

export const Board: React.FC<BoardProps> = ({
  board,
  players,
  onTileClick,
  selectedTileIndex,
  selectableTileIndices = [],
  onTileHover,
  activePlayerIndex = 0,
  rollPredictions = {},
  children,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('3D');
  
  // Góc quay tự do 3D (Được điều khiển bằng chuột kéo thả)
  const [tilt, setTilt] = useState(50);
  const [rotation, setRotation] = useState(-30);

  // Góc quay tự động trong các chế độ bám sát
  const [autoTilt, setAutoTilt] = useState(60);
  const [autoRotation, setAutoRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState('50% 50%');

  // Trạng thái kéo chuột xoay bàn cờ
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, tilt: 50, rotation: -30 });

  // Cập nhật camera bám sát theo vị trí người chơi hiện tại (3P hoặc 1P)
  useEffect(() => {
    if (viewMode !== '3P' && viewMode !== '1P') {
      setScale(1);
      setOrigin('50% 50%');
      return;
    }

    const currentPlayer = players[activePlayerIndex];
    if (!currentPlayer || currentPlayer.isBankrupt) return;

    const pos = currentPlayer.position;
    setOrigin(getTilePercentPosition(pos));

    if (pos >= 0 && pos < 10) {
      setAutoRotation(0);
    } else if (pos >= 10 && pos < 20) {
      setAutoRotation(90);
    } else if (pos >= 20 && pos < 30) {
      setAutoRotation(180);
    } else if (pos >= 30 && pos < 40) {
      setAutoRotation(-90);
    }

    if (viewMode === '1P') {
      setAutoTilt(78);
      setScale(2.5);
    } else {
      setAutoTilt(60);
      setScale(1.2);
    }
  }, [viewMode, activePlayerIndex, players]);

  // Xử lý sự kiện nhấn chuột để xoay 3D
  const handleMouseDown = (e: React.MouseEvent) => {
    if (viewMode !== '3D') return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      tilt: tilt,
      rotation: rotation,
    };
  };

  // Xử lý sự kiện kéo chuột
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || viewMode !== '3D') return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    // Kéo ngang để xoay quanh trục Z, kéo dọc để thay đổi độ nghiêng X
    const newRotation = dragStartRef.current.rotation + deltaX * 0.4;
    const newTilt = Math.max(15, Math.min(75, dragStartRef.current.tilt - deltaY * 0.35));
    
    setRotation(newRotation);
    setTilt(newTilt);
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Xử lý sự kiện chạm màn hình trên thiết bị di động
  const handleTouchStart = (e: React.TouchEvent) => {
    if (viewMode !== '3D' || e.touches.length === 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      tilt: tilt,
      rotation: rotation,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || viewMode !== '3D' || e.touches.length === 0) return;
    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;
    
    const newRotation = dragStartRef.current.rotation + deltaX * 0.4;
    const newTilt = Math.max(15, Math.min(75, dragStartRef.current.tilt - deltaY * 0.35));
    
    setRotation(newRotation);
    setTilt(newTilt);
  };

  const finalTilt = viewMode === '2D' ? 0 : (viewMode === '3P' || viewMode === '1P') ? autoTilt : tilt;
  const finalRotation = viewMode === '2D' ? 0 : (viewMode === '3P' || viewMode === '1P') ? autoRotation : rotation;
  const is3D = viewMode !== '2D';

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[650px] relative select-none">
      {/* Điều khiển camera thông minh */}
      <div className="flex justify-between items-center w-full px-4 py-2 bg-slate-900/90 border border-white/5 rounded-2xl text-xs gap-3 shadow-lg z-20">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-wider">Góc nhìn:</span>
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-white/5">
            {(['2D', '3D', '3P', '1P'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 rounded-md font-black text-[9px] uppercase transition-all duration-200 active:scale-95 cursor-pointer
                  ${viewMode === mode 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                {mode === '2D' ? '2D' : mode === '3D' ? '3D Tự Do' : mode === '3P' ? '3P Bám Lượt' : '1P Nhập Vai'}
              </button>
            ))}
          </div>
        </div>

        {viewMode === '3D' && (
          <div className="text-[8.5px] text-amber-400 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5">
            <span>🖱️</span>
            <span>Nhấp & Kéo chuột để xoay bàn cờ tự do!</span>
          </div>
        )}

        {(viewMode === '3P' || viewMode === '1P') && (
          <div className="text-[9px] text-emerald-400 font-bold animate-pulse">
            🎥 Camera {viewMode === '1P' ? 'Góc Nhìn Thứ Nhất (1P) đường phố' : 'Góc Nhìn Thứ Ba (3P) bám lượt'}
          </div>
        )}
      </div>

      {/* Perspective Container */}
      <div 
        className={`w-full relative transition-all duration-300 flex items-center justify-center
          ${viewMode === '3D' ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{
          perspective: is3D ? '1200px' : 'none',
          paddingBottom: is3D ? '60px' : '0px',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
      >
        <div 
          className="w-full aspect-square bg-[#cbd5e1] border-4 border-slate-300 rounded-3xl p-1 transition-all duration-700 ease-out"
          style={{
            transformStyle: is3D ? 'preserve-3d' : 'flat',
            transformOrigin: is3D ? origin : '50% 50%',
            transform: is3D 
              ? `rotateX(${finalTilt}deg) rotateZ(${finalRotation}deg) scale(${scale})` 
              : 'none',
            boxShadow: is3D 
              ? '0 30px 60px rgba(0,0,0,0.65), 0 12px 24px rgba(0,0,0,0.45), inset 0 0 15px rgba(255,255,255,0.2)' 
              : '0 10px 25px rgba(0,0,0,0.5)',
          }}
        >
          <div className="grid grid-cols-11 grid-rows-11 gap-0.5 w-full h-full rounded-2xl overflow-hidden bg-slate-200"
            style={is3D ? { transformStyle: 'preserve-3d' } : {}}
          >
            {board.map((tile) => {
              const pos = getTileGridPosition(tile.index);
              const playersOnTile = players.filter((p) => p.position === tile.index && !p.isBankrupt);
              const isSelectable = selectableTileIndices.includes(tile.index);
              const owner = players.find((p) => p.userId === tile.ownerId);

              return (
                <div
                  key={tile.index}
                  onMouseEnter={() => onTileHover?.(tile.index)}
                  onMouseLeave={() => onTileHover?.(null)}
                  style={{
                    gridRow: pos.gridRow,
                    gridColumn: pos.gridColumn,
                    transformStyle: is3D ? 'preserve-3d' : 'flat',
                  }}
                >
                  <Tile
                    tile={tile}
                    playersOnTile={playersOnTile}
                    isSelectable={isSelectable || selectedTileIndex === tile.index}
                    onClick={() => onTileClick?.(tile.index)}
                    is3D={is3D}
                    tilt={finalTilt}
                    rotation={finalRotation}
                    owner={owner}
                    predictionRolls={rollPredictions[tile.index] || []}
                  />
                </div>
              );
            })}

            {/* Center of the Board */}
            <div 
              className="col-start-2 col-end-11 row-start-2 row-end-11 bg-[#e8f5e9]/95 flex flex-col justify-between p-4 relative z-0 border border-slate-200 rounded-2xl m-0.5 shadow-inner"
              style={{
                transform: is3D ? 'translateZ(1px)' : 'none',
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
