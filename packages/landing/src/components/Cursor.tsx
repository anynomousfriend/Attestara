import { useEffect, useRef } from "react";

export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
    };
    window.addEventListener("mousemove", onMove);

    let raf: number;
    const tick = () => {
      const p = pos.current;
      p.cx += (p.x - p.cx) * 0.15;
      p.cy += (p.y - p.cy) * 0.15;
      el.style.transform = `translate(${p.cx}px, ${p.cy}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Hover effects
    const onEnter = (e: Event) => {
      const t = e.currentTarget as HTMLElement;
      if (t.classList.contains("btn-primary")) el.classList.add("cursor-cta");
      else el.classList.add("cursor-hover");
    };
    const onLeave = () => el.classList.remove("cursor-hover", "cursor-cta");

    const targets = document.querySelectorAll<HTMLElement>("a, button, .interactive");
    targets.forEach(t => {
      t.addEventListener("mouseenter", onEnter);
      t.addEventListener("mouseleave", onLeave);
    });

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      targets.forEach(t => {
        t.removeEventListener("mouseenter", onEnter);
        t.removeEventListener("mouseleave", onLeave);
      });
    };
  }, []);

  return <div className="cursor-dot" ref={ref} />;
}
