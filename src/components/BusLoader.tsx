import { useEffect, useId, useRef, useState } from "react";
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

interface BusLoaderProps {
  isLoading?: boolean;
  message?: string;
}

export default function BusLoader({
  isLoading = true,
  message = "Finding bus stops...",
}: BusLoaderProps) {
  const chassisRef = useRef<SVGGElement>(null);
  const flagRef = useRef<SVGGElement>(null);
  const mirrorRef = useRef<SVGGElement>(null);
  const wheelRefs = useRef<Array<SVGGElement | null>>([]);
  const spinRefs = useRef<Array<SVGGElement | null>>([]);
  const bumpRef = useRef<SVGGElement>(null);
  const id = useId().replace(/:/g, "");

  // Hide native splash screen as soon as BusLoader mounts (prevents black gap)
  useEffect(() => {
    if (isLoading && Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let frameId = 0;
    const start = performance.now();

    const wheelLift = (bumpX: number, wheelX: number) => {
      const distance = Math.abs(bumpX - wheelX);
      if (distance >= 38) return 0;
      return -10.5 * 0.5 * (1 + Math.cos(Math.PI * (distance / 38)));
    };

    const animate = (now: number) => {
      const time = (now - start) / 1000;
      const phase = (time % 3.5) / 3.5;
      const bumpX = phase < 0.86 ? 735 - (phase / 0.86) * 750 : 760;
      const lifts = [wheelLift(bumpX, 195), wheelLift(bumpX, 265.5), wheelLift(bumpX, 495.5)];
      const rumble = Math.sin(time * 28) * 0.75;
      const rearLift = (lifts[0] * 0.65 + lifts[1] * 0.65);
      const frontLift = lifts[2] * 0.72;
      const chassisY = (frontLift + rearLift) * 0.52 + rumble;
      const pitch = (frontLift - rearLift) * 0.14;
      const wobble = Math.sin(time * 18) * 0.4 + pitch * 0.35;

      bumpRef.current?.setAttribute("transform", `translate(${bumpX.toFixed(2)}, 0)`);
      wheelRefs.current.forEach((wheel, index) => {
        wheel?.setAttribute("transform", `translate(0, ${lifts[index].toFixed(2)})`);
      });
      chassisRef.current?.setAttribute(
        "transform",
        `translate(0, ${chassisY.toFixed(2)}) rotate(${pitch.toFixed(2)}, 345, 250)`,
      );
      flagRef.current?.setAttribute("transform", `rotate(${wobble.toFixed(2)}, 640, 80)`);
      mirrorRef.current?.setAttribute("transform", `rotate(${(wobble * 0.6).toFixed(2)}, 580, 105)`);

      const angle = (time * 260) % 360;
      spinRefs.current.forEach((spin, index) => {
        const centers = [[195, 259.5], [265.5, 259.5], [495.5, 259.5]][index];
        spin?.setAttribute("transform", `rotate(${angle.toFixed(1)}, ${centers[0]}, ${centers[1]})`);
      });

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isLoading]);

  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setFadeOut(true);
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
      setFadeOut(false);
    }
  }, [isLoading]);

  if (!visible) return null;

  const windowClipIds = Array.from({ length: 6 }, (_, index) => `${id}-window-${index}`);

  return (
    <div
      className={`fixed inset-0 z-[99999] flex min-h-[100dvh] flex-col items-center justify-center bg-white px-[max(1.5rem,env(safe-area-inset-left))] py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-opacity duration-400 will-change-[opacity] ${fadeOut ? "opacity-0" : "opacity-100"}`}
      aria-busy="true"
    >
      <div className="flex w-full max-w-2xl flex-col items-center">
        <svg
          className="h-auto w-full max-w-[680px] select-none"
          viewBox="0 0 720 320"
          role="img"
          aria-label="Animated yellow bus"
        >
          <defs>
            {windowClipIds.map((clipId, index) => {
              const x = [90, 145, 218, 291, 364, 437][index];
              const width = index === 0 ? 20 : 57;
              return (
                <clipPath id={clipId} key={clipId}>
                  <rect x={x} y="100" width={width} height="55" rx={index === 0 ? 8 : 10} />
                </clipPath>
              );
            })}
            <clipPath id={`${id}-door-window`}>
              <path d="M 513 108 A 8 8 0 0 1 521 100 H 562 A 8 8 0 0 1 570 108 V 177 H 513 Z" />
            </clipPath>
            <clipPath id={`${id}-road`}>
              <rect x="13" y="270" width="694" height="22" />
            </clipPath>
          </defs>

          <g ref={chassisRef}>
            <g ref={flagRef}>
              <line x1="640" y1="26" x2="640" y2="112" stroke="#6a164c" strokeWidth="5.5" strokeLinecap="round" />
              <rect x="581" y="25" width="59" height="29" rx="4" fill="#fdb53e" stroke="#6a164c" strokeWidth="5.5" />
              <rect x="584" y="28" width="53" height="4.5" rx="2" fill="#fddca8" />
            </g>
            <path d="M 158 80 V 68 A 10 10 0 0 1 168 58 H 264 A 10 10 0 0 1 274 68 V 80 Z" fill="#fdb53e" stroke="#6a164c" strokeWidth="4" />
            <path d="M 409 80 V 68 A 10 10 0 0 1 419 58 H 509 A 10 10 0 0 1 519 68 V 80 Z" fill="#fdb53e" stroke="#6a164c" strokeWidth="4.8" />
            <path d="M 413 65 H 515" stroke="#fddca8" strokeWidth="4" strokeLinecap="round" />

            <path d="M 89 102 A 22 22 0 0 1 111 80 H 586 A 22 22 0 0 1 608 102 V 268 H 165 L 96 256 A 9 9 0 0 1 89 247 Z" fill="#fdb53e" />
            <path d="M 95 96 A 16 16 0 0 1 111 83 H 586 A 16 16 0 0 1 602 96 Z" fill="#fddca8" />
            <path d="M 91 241 L 165 254 H 606 V 268 H 165 L 96 256 A 9 9 0 0 1 89 247 Z" fill="#d28743" />
            <path d="M 101 167 H 322 L 353 218 H 606 V 243 H 336 L 304 197 H 101 Z" fill="white" />

            <g ref={mirrorRef}>
              <path d="M 578 101 H 598 V 118 H 578 Z" fill="#fdb53e" stroke="#6a164c" strokeWidth="4.5" />
              <line x1="580" y1="106" x2="558" y2="116" stroke="#6a164c" strokeWidth="4.5" strokeLinecap="round" />
            </g>

            {windowClipIds.map((clipId, index) => {
              const x = [90, 145, 218, 291, 364, 437][index];
              const width = index === 0 ? 20 : 57;
              return (
                <g key={clipId}>
                  <rect x={x} y="100" width={width} height="55" rx={index === 0 ? 8 : 10} fill="#2abdfd" />
                  <g clipPath={`url(#${clipId})`}>
                    <path d={`M ${x + 7} 98 L ${x + 16} 98 L ${x + width - 8} 157 L ${x + width - 17} 157 Z`} fill="#8adaff" />
                    <path d={`M ${x + 23} 98 L ${x + 29} 98 L ${x + width + 1} 157 L ${x + width - 5} 157 Z`} fill="#8adaff" />
                  </g>
                  <rect x={x} y="100" width={width} height="55" rx={index === 0 ? 8 : 10} fill="none" stroke="#6a164c" strokeWidth="5.2" />
                </g>
              );
            })}

            <path d="M 513 108 A 8 8 0 0 1 521 100 H 562 A 8 8 0 0 1 570 108 V 243 A 8 8 0 0 1 562 251 H 538 A 8 8 0 0 1 531 245 L 524 227 L 515 217 A 10 10 0 0 1 513 210 Z" fill="#fdb53e" stroke="#6a164c" strokeWidth="5.2" />
            <g clipPath={`url(#${id}-door-window)`}>
              <rect x="513" y="100" width="57" height="77" fill="#2abdfd" />
              <path d="M 521 98 L 530 98 L 572 175 L 563 175 Z" fill="#8adaff" />
              <path d="M 540 98 L 546 98 L 580 160 L 574 160 Z" fill="#8adaff" />
            </g>
            <line x1="513" y1="177" x2="570" y2="177" stroke="#6a164c" strokeWidth="5.2" />
            <path d="M 515 218 H 570 V 241 H 531 L 524 227 Z" fill="white" />
            <path d="M 531 241 H 570 V 251 H 538 A 8 8 0 0 1 531 245 Z" fill="#d28743" />
            <rect x="521" y="185" width="6.5" height="16" rx="2.5" fill="#6a164c" />
            <path d="M 89 167 H 96 A 6 6 0 0 1 102 173 V 237 A 6 6 0 0 1 96 243 H 89 Z" fill="#e03c31" stroke="#6a164c" strokeWidth="5.2" />
            <line x1="89" y1="193" x2="102" y2="193" stroke="#6a164c" strokeWidth="4.8" />
            <line x1="89" y1="218" x2="102" y2="218" stroke="#6a164c" strokeWidth="4.8" />
            <rect x="593" y="239" width="25" height="29" rx="7" fill="#fdb53e" stroke="#6a164c" strokeWidth="5.2" />
            <path d="M 596 254 H 615 V 265 H 596 Z" fill="#d28743" />
            <path d="M 89 102 A 22 22 0 0 1 111 80 H 586 A 22 22 0 0 1 608 102 V 268 H 165 L 96 256 A 9 9 0 0 1 89 247 Z" fill="none" stroke="#6a164c" strokeWidth="5.5" strokeLinejoin="round" />
          </g>

          {[195, 265.5, 495.5].map((cx, index) => (
            <g
              key={cx}
              ref={(element) => { wheelRefs.current[index] = element; }}
            >
              <circle cx={cx} cy="259.5" r="36" fill="#6a164c" />
              <circle cx={cx} cy="259.5" r="27.5" fill="#786872" stroke="#6a164c" strokeWidth="5.2" />
              <circle cx={cx} cy="259.5" r="15.5" fill="#f5f0f4" stroke="#6a164c" strokeWidth="3.2" />
              <g ref={(element) => { spinRefs.current[index] = element; }}>
                {Array.from({ length: 8 }, (_, dot) => {
                  const angle = (dot * Math.PI) / 4;
                  return (
                    <circle
                      key={dot}
                      cx={cx + Math.cos(angle) * 10}
                      cy={259.5 + Math.sin(angle) * 10}
                      r="1.8"
                      fill="#6a164c"
                    />
                  );
                })}
              </g>
            </g>
          ))}

          <g clipPath={`url(#${id}-road)`}>
            <g ref={bumpRef} transform="translate(760, 0)">
              <path d="M -28 288 Q 0 273 28 288 Z" fill="#6a164c" />
            </g>
          </g>
          <line x1="13" y1="287.5" x2="707" y2="287.5" stroke="#6a164c" strokeWidth="4.5" strokeLinecap="round" />
        </svg>

        <div className="mt-4 flex flex-col items-center gap-2" role="status" aria-live="polite">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.12em] text-[#6a164c]">
            {message}
          </p>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-[#6a164c]/15" aria-hidden="true">
            <div className="h-full w-12 animate-pulse rounded-full bg-[#fdb53e]" />
          </div>
        </div>
      </div>
    </div>
  );
}
