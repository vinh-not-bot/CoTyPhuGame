import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useRealtimeRoom } from '../hooks/useRealtimeRoom';
import { LobbyRoom } from '../components/LobbyRoom';
import { Board } from '../components/Board';
import { PlayerPanel } from '../components/PlayerPanel';
import { DiceRoller } from '../components/DiceRoller';
import { ActionModal } from '../components/ActionModal';
import { TradeModal } from '../components/TradeModal';
import { GameLog } from '../components/GameLog';
import { ResultModal } from '../components/ResultModal';
import { SkillButton } from '../components/SkillButton';
import { getCharacterById } from '../data/characters';

export const GameRoom: React.FC = () => {
  useRealtimeRoom();

  const {
    userId,
    room,
    players,
    gameState,
    trades,
    loading,
    error,
    setError,
    startGame,
    rollDice,
    buyProperty,
    skipBuy,
    payRent,
    payTax,
    drawCard,
    payJailFine,
    useJailFreeCard,
    proposeTrade,
    acceptTrade,
    rejectTrade,
    declareBankruptcy,
    endTurn,
    buildHouse,
    sellHouse,
    mortgageProperty,
    activeSkillUsed,
    activateActiveSkill,
  } = useGameStore();

  const [showTradeForm, setShowTradeForm] = useState(false);
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  
  // Turn Timer State: 30 seconds count down
  const [timeLeft, setTimeLeft] = useState(30);

  const isLobby = room?.status === 'WAITING';
  const activePlayerIdx = gameState?.current_turn_index ?? 0;
  const activePlayer = gameState?.players[activePlayerIdx];
  const isMyTurn = activePlayer?.userId === userId;

  // Lấy nhân vật của tôi
  const myPlayerInGame = gameState?.players.find((p) => p.userId === userId);
  const myCharacterId = myPlayerInGame?.characterId || 'huan_hoa_hong';

  // Tự động thao tác khi hết thời gian (dùng useCallback để tránh render lặp)
  const handleAutoPlay = useCallback(() => {
    if (!gameState) return;
    const phase = gameState.turn_phase;
    if (phase === 'roll') {
      rollDice();
    } else if (phase === 'action' || phase === 'end') {
      endTurn();
    } else if (phase === 'resolve') {
      const activePlayer = gameState.players[gameState.current_turn_index];
      const tile = gameState.board[activePlayer.position];
      if (tile) {
        if (tile.ownerId && tile.ownerId !== userId) {
          payRent();
        } else if (tile.type === 'tax') {
          payTax();
        } else if (tile.type === 'chance' || tile.type === 'communitychest') {
          drawCard(tile.type);
        } else {
          skipBuy();
        }
      }
    }
  }, [gameState, rollDice, endTurn, payRent, payTax, drawCard, skipBuy, userId]);

  // Reset timer khi đổi lượt hoặc đổi phase
  useEffect(() => {
    if (isLobby || !gameState) return;
    setTimeLeft(30);
  }, [gameState, isLobby]);

  // Bộ đếm ngược thời gian
  useEffect(() => {
    if (isLobby || !gameState || gameState.winner_id) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (isMyTurn) {
            handleAutoPlay();
          }
          return 30; // Reset về 30
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLobby, gameState, isMyTurn, handleAutoPlay]);

  if (!room) return null;

  const handleLeaveRoom = () => {
    localStorage.removeItem('cotyphu_room_id');
    window.location.reload();
  };

  const handleRestart = () => {
    window.location.reload();
  };

  const handleProposeTrade = async (
    receiverId: string,
    proposerCash: number,
    proposerProps: number[],
    receiverCash: number,
    receiverProps: number[]
  ) => {
    await proposeTrade(receiverId, proposerCash, proposerProps, receiverCash, receiverProps);
  };

  const handleUseSkill = () => {
    const char = getCharacterById(myCharacterId);
    activateActiveSkill();
    alert(`⚡ Đã kích hoạt kỹ năng chủ động "${char.activeName}" của ${char.name}!\nHiệu ứng: ${char.activeDesc}`);
  };

  if (isLobby) {
    const lobbyPlayers = players.map((p) => ({
      userId: p.userId,
      display_name: p.display_name,
      avatar_color: p.avatar_color || '#3b82f6',
      is_host: p.is_host,
      character_id: p.character_id,
    }));

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b1329] text-white">
        <LobbyRoom
          room={room}
          players={lobbyPlayers}
          currentUserId={userId}
          onStartGame={startGame}
          onLeaveRoom={handleLeaveRoom}
        />
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1329] text-white font-bold text-sm">
        Đang tải dữ liệu bàn cờ...
      </div>
    );
  }

  const selectedTile = selectedTileIndex !== null ? gameState.board[selectedTileIndex] : null;
  const isOwnerOfSelected = selectedTile?.ownerId === userId;
  const hasIncomingTrade = trades.some((t) => t.receiver_id === userId && t.status === 'PENDING');

  const checkMonopoly = (tile: any) => {
    if (tile.type !== 'property' || tile.mortgaged) return false;
    const color = tile.colorGroup;
    const sameColorTiles = gameState.board.filter((t) => t.colorGroup === color);
    return sameColorTiles.every((t) => t.ownerId === userId && !t.mortgaged);
  };

  return (
    <div className="min-h-screen bg-[#0b1329] p-4 text-white flex flex-col md:flex-row items-center justify-center gap-6 select-none">
      <PlayerPanel
        players={gameState.players}
        activePlayerIndex={gameState.current_turn_index}
        currentUserId={userId}
        board={gameState.board}
      />

      <div className="flex flex-col items-center gap-4 relative">
        <button
          onClick={handleLeaveRoom}
          className="absolute -top-10 right-0 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white rounded text-[10px] font-bold z-10 transition-all shadow-md"
        >
          Thoát Trận
        </button>

        {error && (
          <div className="absolute -top-10 left-0 bg-red-900/90 border border-red-500 text-red-100 px-3 py-1.5 rounded text-[10px] font-bold z-10 text-center max-w-[280px] shadow-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-white font-bold">✕</button>
          </div>
        )}

        <Board
          board={gameState.board}
          players={gameState.players}
          selectedTileIndex={selectedTileIndex}
          onTileClick={(idx) => {
            const tile = gameState.board[idx];
            if (tile.ownerId === userId) {
              setSelectedTileIndex(idx);
            } else {
              setSelectedTileIndex(null);
            }
          }}
        >
          {selectedTile && isOwnerOfSelected ? (
            <div className="flex-1 flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-4 text-slate-800 shadow-md animate-fade-in my-1">
              <div>
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-2">
                  <span className="font-black text-emerald-600 uppercase tracking-wider text-[10px]">
                    Quản Lý Tài Sản
                  </span>
                  <button
                    onClick={() => setSelectedTileIndex(null)}
                    className="text-slate-400 hover:text-slate-800 font-bold"
                  >
                    ✕
                  </button>
                </div>
                <h4 className="text-sm font-black text-slate-900 mb-1">{selectedTile.name}</h4>
                <div className="text-[10px] text-slate-600 flex flex-col gap-1">
                  <div>Loại: <span className="font-bold text-slate-800">{selectedTile.type === 'property' ? 'Đất Đai' : selectedTile.type === 'railroad' ? 'Nhà Ga' : 'Tiện Ích'}</span></div>
                  {selectedTile.type === 'property' && (
                    <div>Cấp độ: <span className="font-bold text-emerald-600">
                      {selectedTile.houses === 5 ? '1 Khách Sạn' : `${selectedTile.houses} Nhà`}
                    </span></div>
                  )}
                  <div>Trạng thái: <span className="font-bold text-slate-800">{selectedTile.mortgaged ? 'Đang Thế Chấp' : 'Bình Thường'}</span></div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-end mt-2 pt-2 border-t border-slate-100">
                {selectedTile.type === 'property' && checkMonopoly(selectedTile) && (
                  <>
                    <button
                      onClick={() => sellHouse(selectedTile.index)}
                      disabled={selectedTile.houses === 0}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg text-white font-bold text-[10px]"
                    >
                      Bán Nhà (+${selectedTile.housePrice / 2})
                    </button>
                    <button
                      onClick={() => buildHouse(selectedTile.index)}
                      disabled={selectedTile.houses >= 5 || (activePlayer?.cash ?? 0) < selectedTile.housePrice}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg text-white font-bold text-[10px]"
                    >
                      Xây Nhà (-${selectedTile.housePrice})
                    </button>
                  </>
                )}
                <button
                  onClick={() => mortgageProperty(selectedTile.index)}
                  disabled={selectedTile.type === 'property' && selectedTile.houses > 0}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg text-white font-bold text-[10px]"
                >
                  {selectedTile.mortgaged ? `Giải chấp (-$${Math.floor(selectedTile.price * 0.55)})` : `Thế chấp (+$${selectedTile.price / 2})`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between my-1 min-h-[140px] bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm text-slate-800">
              {/* Game Room Header & SkillButton placement */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="text-left">
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider block">
                    LƯỢT HIỆN TẠI
                  </span>
                  <h2 className="text-sm font-black text-slate-800 mt-0.5">
                    {isMyTurn ? (
                      <span className="text-emerald-600">Lượt đi của bạn!</span>
                    ) : (
                      <span>Lượt: <span className="text-slate-900 font-black">{activePlayer?.name}</span></span>
                    )}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {/* Timer display badge */}
                  <div className={`flex items-center gap-1 px-2.5 py-0.8 rounded-full border text-[10px] font-black shadow-sm transition-all duration-300
                    ${timeLeft <= 10 
                      ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    }`}>
                    <span>⏱️</span>
                    <span>{timeLeft}s</span>
                  </div>

                  {/* Skill Button for current client */}
                  {!isLobby && myPlayerInGame && (
                    <SkillButton
                      characterId={myCharacterId}
                      isActiveSkillUsed={activeSkillUsed}
                      onUseActiveSkill={handleUseSkill}
                      disabled={!isMyTurn || gameState.winner_id !== null}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center py-2 flex-grow">
                {gameState.turn_phase === 'roll' && (
                  <div className="flex flex-col items-center gap-2">
                    {isMyTurn && activePlayer?.inJail && (
                      <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center mb-1 max-w-[240px]">
                        <p className="text-[9px] text-rose-600 font-black mb-1.5 uppercase tracking-wider">BẠN ĐANG Ở TRONG TÙ!</p>
                        <div className="flex gap-1.5 justify-center">
                          <button
                            onClick={payJailFine}
                            disabled={(activePlayer?.cash ?? 0) < 50}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-[9px] font-black"
                          >
                            Nộp phạt $50
                          </button>
                          {activePlayer?.jailFreeCards && activePlayer.jailFreeCards > 0 && (
                            <button
                              onClick={useJailFreeCard}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-[9px] font-black"
                            >
                              Dùng thẻ thoát tù
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <DiceRoller
                      dice={gameState.last_dice}
                      onRoll={rollDice}
                      isMyTurn={isMyTurn}
                      disabled={loading}
                    />
                  </div>
                )}

                {gameState.turn_phase === 'resolve' && (
                  <ActionModal
                    gameState={gameState}
                    currentUserId={userId}
                    onBuy={buyProperty}
                    onSkipBuy={skipBuy}
                    onPayRent={payRent}
                    onPayTax={payTax}
                    onDrawCard={drawCard}
                    onDeclareBankruptcy={declareBankruptcy}
                  />
                )}

                {(gameState.turn_phase === 'action' || gameState.turn_phase === 'end') && isMyTurn && (
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="text-[9px] text-slate-500 font-medium text-center max-w-[260px]">
                      Mẹo: Click vào đất của bạn trên bản đồ để xây nhà hoặc thế chấp.
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => setShowTradeForm(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-black text-xs shadow active:scale-95 transition-all"
                      >
                        Thương Lượng
                      </button>
                      <button
                        onClick={endTurn}
                        disabled={(activePlayer?.cash ?? 0) < 0}
                        className={`px-5 py-2 rounded-xl text-white font-black text-xs shadow-md transition-all active:scale-95
                          ${(activePlayer?.cash ?? 0) >= 0
                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                            : 'bg-slate-300 text-slate-400 cursor-not-allowed opacity-50'
                          }`}
                      >
                        Kết Thúc Lượt
                      </button>
                    </div>
                  </div>
                )}

                {(gameState.turn_phase === 'action' || gameState.turn_phase === 'end') && !isMyTurn && (
                  <div className="text-center py-2 animate-pulse">
                    <p className="text-xs text-slate-500 font-bold">
                      Đang đợi tỷ phú <span className="font-black text-slate-800">{activePlayer?.name}</span> thao tác.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <GameLog logs={gameState.log || []} />
        </Board>
      </div>

      {(showTradeForm || hasIncomingTrade) && (
        <TradeModal
          gameState={gameState}
          currentUserId={userId}
          activeTrades={trades}
          onPropose={handleProposeTrade}
          onAccept={acceptTrade}
          onReject={rejectTrade}
          onClose={() => setShowTradeForm(false)}
        />
      )}

      {room.status === 'FINISHED' && (
        <ResultModal gameState={gameState} onRestart={handleRestart} />
      )}
    </div>
  );
};
