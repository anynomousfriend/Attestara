import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function Navbar() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ScrollTrigger.create({
      start: "top -100px",
      onEnter:     () => ref.current?.classList.add("visible"),
      onLeaveBack: () => ref.current?.classList.remove("visible"),
    });
  }, []);

  return (
    <nav className="navbar" ref={ref}>
      <div className="nav-logo">Attestara</div>
      <button className="btn-primary btn-nav interactive">Launch App</button>
    </nav>
  );
}
