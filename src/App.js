import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:4000', { autoConnect: false });

function App() {
  const [gameMode, setGameMode] = useState(null); // null, 'single', 'multi'
  const [roomId, setRoomId] = useState('');
  const [joinedRoomId, setJoinedRoomId] = useState('');
  const [side, setSide] = useState('left');
  const [gameStarted, setGameStarted] = useState(false);
  const [ball, setBall] = useState({ x: 400, y: 300, dx: 5, dy: 5 });
  const [paddles, setPaddles] = useState({ left: 150, right: 150 });
  const [scores, setScores] = useState({ left: 0, right: 0 });
  const [trail, setTrail] = useState([]);
  const [hitAnimation, setHitAnimation] = useState({ left: 0, right: 0 });
  const [scoreFlash, setScoreFlash] = useState({ left: false, right: false });
  const [particles, setParticles] = useState([]);
  const canvasRef = useRef(null);
  const [isMovingUp, setIsMovingUp] = useState(false);
  const [isMovingDown, setIsMovingDown] = useState(false);
  const aiTargetRef = useRef(paddles.right); // ذخیره هدف AI برای جلوگیری از لرزش

  // تولید ذرات جرقه با رنگ توپ
  const createParticles = (x, y, side) => {
    const newParticles = [];
    const particleCount = 20;
    const ballColor = '#ff4500'; // رنگ توپ
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        x,
        y,
        dx: side === 'left' ? (Math.random() * 3 + 2) : -(Math.random() * 3 + 2),
        dy: (Math.random() - 0.5) * 6,
        life: 20,
        color: ballColor,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
  };

  // Game Loop برای سینگل‌پلیر
  useEffect(() => {
    if (gameMode === 'single' && gameStarted) {
      let lastBounce = null; // ذخیره آخرین موقعیت برای تشخیص برخورد
      const interval = setInterval(() => {
        setBall((prev) => {
          let newBall = { ...prev };
          // اعمال اصطکاک و شتاب
          const maxSpeed = 10;
          const acceleration = 0.02;
          const friction = 0.995;
          newBall.dx = Math.min(Math.abs(newBall.dx) + acceleration, maxSpeed) * Math.sign(newBall.dx);
          newBall.dy *= friction;
          newBall.x += newBall.dx;
          newBall.y += newBall.dy;

          // تشخیص برخورد برای به‌روزرسانی هدف AI
          const currentBounce = `${newBall.y <= 10 || newBall.y >= 590}_${newBall.x <= 20 && newBall.x > 10 && newBall.y >= paddles.left && newBall.y <= paddles.left + 100}_${newBall.x >= 780 && newBall.x < 790 && newBall.y >= paddles.right && newBall.y <= paddles.right + 100}`;
          if (currentBounce !== lastBounce) {
            lastBounce = currentBounce;
            // به‌روزرسانی هدف AI فقط در برخورد
            if (newBall.dx > 0) { // وقتی توپ به سمت راست می‌رود
              const timeToReach = (780 - newBall.x) / newBall.dx; // زمان تقریبی تا پادل راست
              let targetY = newBall.y + newBall.dy * timeToReach - 50; // پیش‌بینی y
              targetY = Math.max(0, Math.min(targetY, 500)); // محدود کردن
              // سختی پویا بر اساس امتیاز
              const playerScore = scores.left;
              const aiScore = scores.right;
              let errorMargin = 20; // خطای پایه
              if (playerScore > 5 && playerScore > aiScore) {
                errorMargin = 10; // کاهش خطا
              } else if (aiScore > 5 && aiScore > playerScore) {
                errorMargin = 30; // افزایش خطا
              }
              aiTargetRef.current = targetY + (Math.random() - 0.5) * errorMargin; // خطای تصادفی
            }
          }

          // به‌روزرسانی دنباله
          setTrail((prevTrail) => [
            ...prevTrail.slice(-5),
            { x: newBall.x, y: newBall.y, opacity: 1 },
          ].map((point, index) => ({
            ...point,
            opacity: 1 - index * 0.2,
          })));

          // برخورد با دیوارها
          if (newBall.y <= 10 || newBall.y >= 590) {
            newBall.dy *= -1;
            newBall.y = newBall.y <= 10 ? 10 : 590;
          }

          // برخورد با پادل چپ
          if (
            newBall.x <= 20 &&
            newBall.x > 10 &&
            newBall.y >= paddles.left &&
            newBall.y <= paddles.left + 100
          ) {
            const hitPoint = (newBall.y - paddles.left - 50) / 50; // -1 (بالا) تا +1 (پایین)
            newBall.dx = Math.abs(newBall.dx) * 1.1;
            newBall.dy += hitPoint * 3;
            newBall.x = 20;
            setHitAnimation((prev) => ({ ...prev, left: 10 }));
            createParticles(newBall.x, newBall.y, 'left');
          }

          // برخورد با پادل راست
          if (
            newBall.x >= 780 &&
            newBall.x < 790 &&
            newBall.y >= paddles.right &&
            newBall.y <= paddles.right + 100
          ) {
            const hitPoint = (newBall.y - paddles.right - 50) / 50; // -1 (بالا) تا +1 (پایین)
            newBall.dx = -Math.abs(newBall.dx) * 1.1;
            newBall.dy += hitPoint * 3;
            newBall.x = 780;
            setHitAnimation((prev) => ({ ...prev, right: 10 }));
            createParticles(newBall.x, newBall.y, 'right');
          }

          // محدود کردن سرعت عمودی
          newBall.dy = Math.max(Math.min(newBall.dy, 8), -8);

          // امتیاز
          if (newBall.x <= 0) {
            setScores((prev) => ({ ...prev, right: prev.right + 1 }));
            setScoreFlash((prev) => ({ ...prev, right: true }));
            newBall = {
              x: 400,
              y: 300,
              dx: 5 * (Math.random() > 0.5 ? 1 : -1),
              dy: 5 * (Math.random() > 0.5 ? 1 : -1),
            };
            setTrail([]);
            setParticles([]);
            aiTargetRef.current = 150; // بازنشانی هدف AI
          }
          if (newBall.x >= 800) {
            setScores((prev) => ({ ...prev, left: prev.left + 1 }));
            setScoreFlash((prev) => ({ ...prev, left: true }));
            newBall = {
              x: 400,
              y: 300,
              dx: 5 * (Math.random() > 0.5 ? 1 : -1),
              dy: 5 * (Math.random() > 0.5 ? 1 : -1),
            };
            setTrail([]);
            setParticles([]);
            aiTargetRef.current = 150; // بازنشانی هدف AI
          }

          return newBall;
        });

        // AI حرفه‌ای برای پادل راست
        setPaddles((prev) => {
          const playerScore = scores.left;
          const aiScore = scores.right;
          let aiSpeed = 5; // سرعت پایه
          if (playerScore > 5 && playerScore > aiScore) {
            aiSpeed = 6; // افزایش سرعت
          } else if (aiScore > 5 && aiScore > playerScore) {
            aiSpeed = 4; // کاهش سرعت
          }

          // حرکت روان با interpolation
          let newRight = prev.right;
          const lerpFactor = 0.1; // فاکتور نرم‌سازی
          newRight += (aiTargetRef.current - newRight) * lerpFactor;
          newRight = Math.max(0, Math.min(newRight, 500)); // محدود کردن

          return { ...prev, right: newRight };
        });

        // حرکت پادل چپ
        setPaddles((prev) => {
          let newLeft = prev.left;
          const speed = 8;
          if (isMovingUp && newLeft > 0) {
            newLeft -= speed;
          }
          if (isMovingDown && newLeft < 500) {
            newLeft += speed;
          }
          return { ...prev, left: newLeft };
        });

        // کاهش لرزش پادل‌ها
        setHitAnimation((prev) => ({
          left: Math.max(0, prev.left - 1),
          right: Math.max(0, prev.right - 1),
        }));

        // خاموش کردن چشمک امتیاز
        setScoreFlash((prev) => ({
          left: prev.left ? false : prev.left,
          right: prev.right ? false : prev.right,
        }));

        // به‌روزرسانی ذرات
        setParticles((prev) =>
          prev
            .map((particle) => ({
              ...particle,
              x: particle.x + particle.dx,
              y: particle.y + particle.dy,
              life: particle.life - 1,
            }))
            .filter((particle) => particle.life > 0)
        );
      }, 16); // 60 FPS

      return () => clearInterval(interval);
    }
  }, [gameMode, gameStarted, ball, paddles.left, isMovingUp, isMovingDown, scores]);

  // Game Loop برای مولتی‌پلیر (فقط انیمیشن‌ها)
  useEffect(() => {
    if (gameMode === 'multi' && gameStarted) {
      const interval = setInterval(() => {
        // به‌روزرسانی دنباله
        setTrail((prevTrail) => [
          ...prevTrail.slice(-5),
          { x: ball.x, y: ball.y, opacity: 1 },
        ].map((point, index) => ({
          ...point,
          opacity: 1 - index * 0.2,
        })));

        // به‌روزرسانی ذرات
        setParticles((prev) =>
          prev
            .map((particle) => ({
              ...particle,
              x: particle.x + particle.dx,
              y: particle.y + particle.dy,
              life: particle.life - 1,
            }))
            .filter((particle) => particle.life > 0)
        );

        // کاهش لرزش پادل‌ها
        setHitAnimation((prev) => ({
          left: Math.max(0, prev.left - 1),
          right: Math.max(0, prev.right - 1),
        }));

        // خاموش کردن چشمک امتیاز
        setScoreFlash((prev) => ({
          left: prev.left ? false : prev.left,
          right: prev.right ? false : prev.right,
        }));
      }, 16); // 60 FPS

      return () => clearInterval(interval);
    }
  }, [gameMode, gameStarted, ball]);

  // رویدادهای سرور برای مولتی‌پلیر
  useEffect(() => {
    if (gameMode === 'multi') {
      socket.connect();
      socket.on('roomCreated', (id) => {
        setRoomId(id);
      });
      socket.on('joinedRoom', ({ side }) => {
        setSide(side);
        setGameStarted(true);
      });
      socket.on('startGame', () => {
        setGameStarted(true);
      });
      socket.on('roomFull', () => {
        alert('اتاق پر است!');
      });
      socket.on('updateBall', (newBall) => {
        setBall(newBall);
        if (
          newBall.x <= 20 &&
          newBall.y >= paddles.left &&
          newBall.y <= paddles.left + 100
        ) {
          createParticles(newBall.x, newBall.y, 'left');
          setHitAnimation((prev) => ({ ...prev, left: 10 }));
        } else if (
          newBall.x >= 780 &&
          newBall.y >= paddles.right &&
          newBall.y <= paddles.right + 100
        ) {
          createParticles(newBall.x, newBall.y, 'right');
          setHitAnimation((prev) => ({ ...prev, right: 10 }));
        }
      });
      socket.on('updatePaddles', (newPaddles) => {
        setPaddles(newPaddles);
      });
      socket.on('updateScores', (newScores) => {
        setScores(newScores);
        if (newScores.left !== scores.left) {
          setScoreFlash((prev) => ({ ...prev, left: true }));
        }
        if (newScores.right !== scores.right) {
          setScoreFlash((prev) => ({ ...prev, right: true }));
        }
        setTrail([]);
        setParticles([]);
      });

      return () => {
        socket.off('roomCreated');
        socket.off('joinedRoom');
        socket.off('startGame');
        socket.off('roomFull');
        socket.off('updateBall');
        socket.off('updatePaddles');
        socket.off('updateScores');
        socket.disconnect();
      };
    }
  }, [gameMode, paddles, scores]);

  // ارسال حرکت پادل برای مولتی‌پلیر
  useEffect(() => {
    if (gameMode === 'multi' && gameStarted) {
      const interval = setInterval(() => {
        let y = paddles[side];
        const speed = 8;
        if (isMovingUp && y > 0) {
          y -= speed;
        }
        if (isMovingDown && y < 500) {
          y += speed;
        }
        socket.emit('movePaddle', {
          roomId: roomId || joinedRoomId,
          side,
          y,
        });
      }, 16);
      return () => clearInterval(interval);
    }
  }, [gameMode, gameStarted, isMovingUp, isMovingDown, side, roomId, joinedRoomId, paddles]);

  // رندر Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // پس‌زمینه گرادیانت
      const gradient = ctx.createLinearGradient(0, 0, 0, 600);
      gradient.addColorStop(0, '#1a1a1a');
      gradient.addColorStop(1, '#333333');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // خط وسط
      ctx.beginPath();
      ctx.setLineDash([5, 15]);
      ctx.moveTo(400, 0);
      ctx.lineTo(400, 600);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.stroke();
      ctx.setLineDash([]);

      // رسم دنباله توپ
      trail.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 165, 0, ${point.opacity * 0.5})`;
        ctx.fill();
        ctx.closePath();
      });

      // رسم ذرات جرقه
      particles.forEach((particle) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 69, 0, ${particle.life / 20})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff4500';
        ctx.fill();
        ctx.closePath();
      });
      ctx.shadowBlur = 0;

      // رسم توپ
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4500';
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(255, 69, 0, 0.8)';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.closePath();

      // رسم پادل چپ با گوشه‌های گرد
      ctx.fillStyle = '#00b7eb';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00b7eb';
      ctx.beginPath();
      ctx.roundRect(
        10 + (hitAnimation.left ? Math.sin(hitAnimation.left * 0.5) * 3 : 0),
        paddles.left,
        10,
        100,
        10
      );
      ctx.fill();
      ctx.closePath();

      // رسم پادل راست با گوشه‌های گرد
      ctx.fillStyle = '#ff1493';
      ctx.beginPath();
      ctx.roundRect(
        780 + (hitAnimation.right ? Math.sin(hitAnimation.right * 0.5) * 3 : 0),
        paddles.right,
        10,
        100,
        10
      );
      ctx.fill();
      ctx.closePath();
      ctx.shadowBlur = 0;

      // رسم امتیازها
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = scoreFlash.left ? '#ffd700' : 'white';
      ctx.shadowBlur = scoreFlash.left ? 15 : 0;
      ctx.shadowColor = '#ffd700';
      ctx.fillText(scores.left, 350, 50);
      ctx.fillStyle = scoreFlash.right ? '#ffd700' : 'white';
      ctx.shadowColor = '#ffd700';
      ctx.fillText(scores.right, 450, 50);
      ctx.shadowBlur = 0;

      // دستورالعمل
      if (!gameStarted) {
        ctx.font = '20px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(
          gameMode === 'multi' ? 'ایجاد اتاق یا وارد کردن Room ID' : 'بازی سینگل‌پلیر',
          200,
          300
        );
      } else {
        ctx.font = '16px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(
          gameMode === 'multi'
            ? `کنترل پادل ${side === 'left' ? 'چپ' : 'راست'} با Arrow Up/Down`
            : 'کنترل پادل چپ با Arrow Up/Down',
          10,
          30
        );
      }
    }
  }, [gameMode, gameStarted, ball, paddles, scores, trail, hitAnimation, scoreFlash, particles, side]);

  // Event handler برای کیبورد
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setIsMovingUp(true);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setIsMovingDown(true);
        break;
      default:
        break;
    }
  };

  const handleKeyUp = (e) => {
    switch (e.key) {
      case 'ArrowUp':
        setIsMovingUp(false);
        break;
      case 'ArrowDown':
        setIsMovingDown(false);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startSinglePlayer = () => {
    setGameMode('single');
    setGameStarted(true);
    setBall({ x: 400, y: 300, dx: 5, dy: 5 });
    setPaddles({ left: 150, right: 150 });
    setScores({ left: 0, right: 0 });
    setTrail([]);
    setParticles([]);
    aiTargetRef.current = 150; // مقدار اولیه هدف AI
  };

  const startMultiPlayer = () => {
    setGameMode('multi');
    setGameStarted(false);
    setRoomId('');
    setJoinedRoomId('');
    setSide('left');
    setBall({ x: 400, y: 300 });
    setPaddles({ left: 150, right: 150 });
    setScores({ left: 0, right: 0 });
    setTrail([]);
    setParticles([]);
  };

  const createRoom = () => {
    socket.emit('createRoom');
  };

  const joinRoom = () => {
    socket.emit('joinRoom', joinedRoomId);
  };

  return (
    <div style={{ textAlign: 'center', background: 'black', height: '100vh', color: 'white' }}>
      <h1>بازی پینگ‌پونگ</h1>
      {!gameMode ? (
        <div>
          <button
            onClick={startSinglePlayer}
            style={{
              padding: '10px 20px',
              margin: '10px',
              background: '#00b7eb',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            start
          </button>
          
        </div>
      ) : gameMode === 'multi' && !gameStarted ? (
        <div>
          <button
            onClick={createRoom}
            style={{
              padding: '10px 20px',
              margin: '10px',
              background: '#00b7eb',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            ایجاد اتاق
          </button>
          {roomId && <p>آیدی اتاق: {roomId}</p>}
          <input
            type="text"
            placeholder="آیدی اتاق"
            value={joinedRoomId}
            onChange={(e) => setJoinedRoomId(e.target.value)}
            style={{ padding: '10px', margin: '10px' }}
          />
          <button
            onClick={joinRoom}
            style={{
              padding: '10px 20px',
              background: '#ff1493',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            پیوستن به اتاق
          </button>
          <button
            onClick={() => setGameMode(null)}
            style={{
              padding: '10px 20px',
              margin: '10px',
              background: '#666',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            بازگشت
          </button>
        </div>
      ) : (
        <div>
          <p>
            {gameMode === 'multi'
              ? `شما پادل ${side === 'left' ? 'چپ' : 'راست'} را کنترل می‌کنید`
              : 'کنترل پادل چپ با Arrow Up/Down'}
          </p>
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            tabIndex={0}
            style={{ border: '2px solid #444', display: 'block', margin: '0 auto' }}
          />
          <button
            onClick={() => {
              setGameMode(null);
              setGameStarted(false);
              if (gameMode === 'multi') socket.disconnect();
            }}
            style={{
              padding: '10px 20px',
              margin: '10px',
              background: '#666',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            بازگشت به منو
          </button>
        </div>
      )}
    </div>
  );
}


export default App;
