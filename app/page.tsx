"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/logo.png";
import "./landing.css";

export default function RootPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Redirect authenticated users
  useEffect(() => {
    if (loading || !user) return;
    router.replace(role === "admin" ? "/admin" : "/dashboard");
  }, [user, role, loading, router]);

  // Drawer keyboard close + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Card calendar mini-grid
  useEffect(() => {
    const cal = calRef.current;
    if (!cal) return;
    const marked = new Set([1,2,3,4,5,8,9,10,11,12,15,16,17,18,22,23,24,29,30]);
    for (let d = 1; d <= 31; d++) {
      const el = document.createElement("div");
      el.className = "cd" + (marked.has(d) ? " m" : "") + (d === 25 ? " t" : "");
      cal.appendChild(el);
    }
    return () => { if (cal) cal.innerHTML = ""; };
  }, []);

  // Growth chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const vals = [30,65,110,155,195,238,280,330,385,445,510,600];
    const lbls = ["Jan'22","Apr","Jul","Oct","Jan'23","Apr","Jul","Oct","Jan'24","Apr","Jul","Dec"];

    function draw() {
      if (!canvas) return;
      const w = canvas.offsetWidth || 300;
      const h = 200;
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      const isDark = document.documentElement.dataset.theme === "dark"
        || (document.documentElement.dataset.theme === undefined
          && window.matchMedia("(prefers-color-scheme:dark)").matches);
      const tc = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
      const gc = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      const pad = { t: 16, r: 16, b: 32, l: 44 };
      const cw = w - pad.l - pad.r;
      const ch = h - pad.t - pad.b;
      const maxV = 650;
      const xp = (i: number) => pad.l + (i / (vals.length - 1)) * cw;
      const yp = (v: number) => pad.t + ch - (v / maxV) * ch;

      [0, 200, 400, 600].forEach((v) => {
        const y = yp(v);
        ctx.strokeStyle = gc; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + cw, y); ctx.stroke();
        ctx.fillStyle = tc; ctx.font = "10px system-ui"; ctx.textAlign = "right";
        ctx.fillText(v === 0 ? "0" : String(v), pad.l - 6, y + 4);
      });

      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
      grad.addColorStop(0, "rgba(212,175,55,0.22)");
      grad.addColorStop(1, "rgba(212,175,55,0)");
      ctx.beginPath();
      ctx.moveTo(xp(0), yp(vals[0]));
      for (let i = 1; i < vals.length; i++) {
        const cx = (xp(i - 1) + xp(i)) / 2;
        ctx.bezierCurveTo(cx, yp(vals[i - 1]), cx, yp(vals[i]), xp(i), yp(vals[i]));
      }
      ctx.lineTo(xp(vals.length - 1), pad.t + ch);
      ctx.lineTo(xp(0), pad.t + ch);
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

      ctx.beginPath();
      ctx.moveTo(xp(0), yp(vals[0]));
      for (let i = 1; i < vals.length; i++) {
        const cx = (xp(i - 1) + xp(i)) / 2;
        ctx.bezierCurveTo(cx, yp(vals[i - 1]), cx, yp(vals[i]), xp(i), yp(vals[i]));
      }
      ctx.strokeStyle = "#D4AF37"; ctx.lineWidth = 2; ctx.stroke();

      [0, 3, 6, 9, 11].forEach((i) => {
        ctx.beginPath(); ctx.arc(xp(i), yp(vals[i]), 4, 0, Math.PI * 2);
        ctx.fillStyle = "#D4AF37"; ctx.fill();
        ctx.beginPath(); ctx.arc(xp(i), yp(vals[i]), 2, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#111" : "#EEE"; ctx.fill();
      });

      ctx.fillStyle = tc; ctx.font = "10px system-ui"; ctx.textAlign = "center";
      [0, 3, 6, 9, 11].forEach((i) => ctx.fillText(lbls[i], xp(i), pad.t + ch + 20));
    }

    draw();
    window.addEventListener("resize", draw);
    const mo = new MutationObserver(draw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { window.removeEventListener("resize", draw); mo.disconnect(); };
  }, []);

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll(".rv");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Nav scroll shadow
  useEffect(() => {
    const nav = document.querySelector("nav");
    const onScroll = () => {
      if (nav) nav.style.boxShadow = window.scrollY > 20 ? "0 1px 24px rgba(0,0,0,.45)" : "";
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!loading && user) return null;

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="lp">
      {/* NAV */}
      <nav>
        <div className="nav-in">
          <a href="#" className="logo">
            <Image src={Logo} alt="ShakaSave" width={120} height={42} style={{ objectFit: "contain", width: "auto", height: 42 }} priority />
          </a>
          <ul className="navlinks">
            <li><a href="#services">Services</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#how">How it works</a></li>
          </ul>
          <div className="navact">
            <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
            <Link href="/register" className="btn btn-gold btn-sm">Start Saving</Link>
            <button
              className={`hbtn${drawerOpen ? " open" : ""}`}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* Drawer overlay */}
      <div className={`overlay${drawerOpen ? " show" : ""}`} aria-hidden="true" onClick={closeDrawer} />

      {/* Drawer panel */}
      <div className={`drawer${drawerOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Navigation menu">
        <div className="dhead">
          <div className="dhead-logo">
            <div className="dhead-mark">S</div>
            <span className="dhead-txt">Shaka<em>Save</em></span>
          </div>
          <button className="dclose" aria-label="Close menu" onClick={closeDrawer}>×</button>
        </div>
        <ul className="dlinks">
          <li><a href="#services" onClick={closeDrawer}>Services</a></li>
          <li><a href="#about" onClick={closeDrawer}>About</a></li>
          <li><a href="#how" onClick={closeDrawer}>How it works</a></li>
        </ul>
        <div className="dact">
          <Link href="/login" className="btn btn-ghost" onClick={closeDrawer}>Log in</Link>
          <Link href="/register" className="btn btn-gold" onClick={closeDrawer}>Start Saving</Link>
        </div>
      </div>

      {/* HERO — grid lines removed */}
      <section className="hero">
        <div className="hglow" />
        <div className="hero-body">
          <div>
            <div className="badge rv">
              <div className="bpulse" />
              <span>Trusted by 600+ Nigerians since 2022</span>
            </div>
            <h1 className="rv">
              Build the habit.<br />Watch the <em>money</em><br />grow.
            </h1>
            <p className="hsub rv">
              SHAKASAVE helps individuals and entrepreneurs save consistently through daily contributions — tracked, transparent, and built around your real goals.
            </p>
            <div className="hbtns rv">
              <Link href="/register" className="btn btn-gold">
                Start Saving
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ marginLeft: 2 }}>
                  <path d="M3 7.5h9M8 3.5l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#about" className="btn btn-ghost">Learn more</a>
            </div>
            <div className="htrust rv">
              <div className="avs">
                <div className="av">A</div>
                <div className="av">B</div>
                <div className="av">F</div>
                <div className="av">C</div>
              </div>
              <p className="trusttxt"><strong>600+ customers</strong> saving with us</p>
            </div>
          </div>

          {/* Card illustration */}
          <div className="hvis">
            <div className="ring r3" />
            <div className="ring r1" />
            <div className="ring r2" />
            <div className="scard">
              <div className="chip" />
              <div className="cdots">•••• •••• •••• 4827</div>
              <div className="ccal" ref={calRef} />
              <div className="cball">Current Balance</div>
              <div className="cbal"><span>₦</span>48,500</div>
              <div className="cfoot">
                <span className="cname">ADEYEMI J.</span>
                <span className="cbrand">SHAKASAVE</span>
              </div>
            </div>
            <div className="coin cn1">₦</div>
            <div className="coin cn2">₦</div>
            <div className="coin cn3">₦</div>
            <div className="toast ts1">
              <div className="tico tgreen">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7l3.5 3.5 5.5-6" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="tl1">Payment confirmed</div>
                <div className="tl2">₦5,000 · 10 days marked</div>
              </div>
            </div>
            <div className="toast ts2">
              <div className="tico tgold">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1.5 11L4.5 6l3 3 3-5 2 2" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="tl1">Goal progress</div>
                <div className="tl2">82% of target saved</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="stats">
        <div className="stats-in">
          <div className="stt rv"><div className="stn">600+</div><div className="stl">Customers served</div></div>
          <div className="stt rv"><div className="stn">2022</div><div className="stl">Established</div></div>
          <div className="stt rv"><div className="stn">5</div><div className="stl">Savings products</div></div>
          <div className="stt rv"><div className="stn">100%</div><div className="stl">Transparent records</div></div>
        </div>
      </div>

      {/* PHOTO SECTION — real savers */}
      <section className="phsec">
        <div className="wrap">
          <div className="phsech rv">
            <span className="eye">Real People</span>
            <h2>Saving made personal</h2>
            <p>Hundreds of Nigerians are already building their financial future with SHAKASAVE — one daily contribution at a time.</p>
          </div>
          <div className="phgrid">
            <div className="phcard rv">
              <div className="phimg">
                {/* Photo by Andrea Piacquadio · Pexels */}
                <img
                  src="https://images.pexels.com/photos/5915255/pexels-photo-5915255.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop"
                  alt="Adaobi — Daily Saver"
                  loading="lazy"
                />
              </div>
              <div className="phinfo">
                <div className="phamt">₦312,000</div>
                <div className="phlbl">Total saved to date</div>
                <div className="phrow">
                  <span className="phname">Adaobi K., Lagos</span>
                  <span className="phtag">Daily</span>
                </div>
              </div>
            </div>
            <div className="phcard rv">
              <div className="phimg">
                {/* Photo by Taiye Salawu · Pexels (Abuja, Nigeria) */}
                <img
                  src="https://images.pexels.com/photos/34690062/pexels-photo-34690062.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop"
                  alt="Emeka — Entrepreneur Saver"
                  loading="lazy"
                />
              </div>
              <div className="phinfo">
                <div className="phamt">₦680,000</div>
                <div className="phlbl">Total saved to date</div>
                <div className="phrow">
                  <span className="phname">Emeka O., Abuja</span>
                  <span className="phtag">Target</span>
                </div>
              </div>
            </div>
            <div className="phcard rv">
              <div className="phimg">
                {/* Photo by ELS Image · Pexels */}
                <img
                  src="https://images.pexels.com/photos/7049517/pexels-photo-7049517.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&fit=crop"
                  alt="Fatima — Food Bank Saver"
                  loading="lazy"
                />
              </div>
              <div className="phinfo">
                <div className="phamt">₦88,500</div>
                <div className="phlbl">Total saved to date</div>
                <div className="phrow">
                  <span className="phname">Fatima B., Kano</span>
                  <span className="phtag">Food Bank</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" style={{ padding: "var(--sec) 0" }}>
        <div className="wrap">
          <div className="sech rv">
            <span className="eye">What We Offer</span>
            <h2>Five ways to build<br />your savings</h2>
            <p>Choose the plan that fits your lifestyle. Every product is designed for discipline, flexibility, and real financial progress.</p>
          </div>
          <div className="srvg">
            <div className="srvc rv">
              <div className="sico">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="4" width="18" height="16" rx="2.5" stroke="#D4AF37" strokeWidth="1.5"/><path d="M2 9h18" stroke="#D4AF37" strokeWidth="1.5"/><path d="M7 2v4M15 2v4" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/><circle cx="7" cy="14" r="1" fill="#D4AF37"/><circle cx="11" cy="14" r="1" fill="#D4AF37"/><circle cx="15" cy="14" r="1" fill="#D4AF37"/></svg>
              </div>
              <h3>Daily Savings</h3>
              <p>Save a fixed amount every day. Your savings card tracks each contribution automatically — every day marked is a day closer to your goal.</p>
            </div>
            <div className="srvc rv">
              <div className="sico">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="#D4AF37" strokeWidth="1.5"/><circle cx="11" cy="11" r="5.5" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="3 2"/><circle cx="11" cy="11" r="2" fill="#D4AF37"/></svg>
              </div>
              <h3>Target Savings</h3>
              <p>Set a specific financial goal — rent, school fees, a new phone — and save steadily until you hit your target amount.</p>
            </div>
            <div className="srvc rv">
              <div className="sico">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 5h14l-1.5 10H5.5L4 5z" stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round"/><path d="M2.5 5h17" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/><path d="M8.5 5V3.5a1 1 0 012 0V5M11.5 5V3.5a1 1 0 012 0V5" stroke="#D4AF37" strokeWidth="1.2" strokeLinecap="round"/><path d="M6.5 18.5h9" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <h3>Food Bank Savings</h3>
              <p>Dedicated savings for household groceries and essentials — so your food budget never catches you off guard again.</p>
            </div>
            <div className="srvc rv">
              <div className="sico">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="7" cy="8" r="3" stroke="#D4AF37" strokeWidth="1.5"/><circle cx="15" cy="8" r="3" stroke="#D4AF37" strokeWidth="1.5"/><path d="M1.5 18.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/><path d="M15.5 13.5c3 0 5 2 5 5" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <h3>Esusu Savings</h3>
              <p>Nigeria&apos;s traditional rotational savings — reimagined digitally. Pool contributions with a trusted group and take turns collecting.</p>
            </div>
            <div className="srvc rv">
              <div className="sico">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="3" width="18" height="16" rx="2" stroke="#D4AF37" strokeWidth="1.5"/><path d="M3 17.5l4.5-5.5 3.5 4 4-6 3 3" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h3>Financial Advisory</h3>
              <p>Get expert guidance on budgeting, goal-setting, and financial planning tailored to your income and lifestyle.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="howbg" style={{ padding: "var(--sec) 0" }}>
        <div className="wrap">
          <div className="sech ctr rv">
            <span className="eye">How It Works</span>
            <h2>Three steps to start saving</h2>
            <p>Getting started takes less than five minutes. No branch visits, no paperwork — just your phone and your financial goals.</p>
          </div>
          <div className="steps">
            <div className="step rv">
              <div className="stepn">1</div>
              <h3>Create your account</h3>
              <p>Register with your name, phone, and email. Your account is verified and ready in minutes — from anywhere in Nigeria.</p>
            </div>
            <div className="step rv">
              <div className="stepn">2</div>
              <h3>Request a savings card</h3>
              <p>Choose your daily contribution amount, make your first payment, and upload proof. Admin reviews and creates your card.</p>
            </div>
            <div className="step rv">
              <div className="stepn">3</div>
              <h3>Track your progress</h3>
              <p>Every confirmed payment marks a day on your card. Watch your balance grow and download your records anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ padding: "var(--sec) 0" }}>
        <div className="wrap">
          <div className="aboutg">
            <div className="abouttxt rv">
              <span className="eye">Our Story</span>
              <h2>Saving simplified — since January 2022</h2>
              <p>SHAKASAVE Finance was established with a simple goal — to help individuals and business owners develop the habit of saving consistently and achieve their financial goals.</p>
              <p>From the beginning, we operated through WhatsApp and social media, manually verifying every payment and updating each customer&apos;s savings card. That commitment to accuracy and personal attention earned the trust of over 600 customers.</p>
              <p>Today, our digital platform automates what was once done by hand — giving customers real-time visibility into their savings, while we serve more people without sacrificing the care SHAKASAVE is known for.</p>
            </div>
            <div className="aboutvis rv">
              <div className="chartpad">
                <span className="eye" style={{ marginBottom: 12 }}>Customers served (2022 – 2025)</span>
                <canvas ref={canvasRef} height={200} />
              </div>
              <div className="improw">
                <div className="imp"><div className="impn">600+</div><div className="impl">Customers</div></div>
                <div className="imp"><div className="impn">3 yrs</div><div className="impl">In operation</div></div>
                <div className="imp"><div className="impn">5</div><div className="impl">Products</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MISSION / VISION / GOAL */}
      <section className="mvgbg" style={{ padding: "var(--sec) 0" }}>
        <div className="wrap">
          <div className="sech ctr rv">
            <span className="eye">Who We Are</span>
            <h2>Purpose-driven savings</h2>
            <p>Everything we do is guided by a clear mission, a bold vision, and a long-term commitment to your financial future.</p>
          </div>
          <div className="mvgg">
            <div className="mvgc rv">
              <div className="mvgico">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 3l2 6h6l-5 3.5 2 6-5-3.5-5 3.5 2-6L3 9h6z" stroke="#D4AF37" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              </div>
              <h3>Our Mission</h3>
              <p>To help individuals and businesses build disciplined saving habits through simple, reliable, and accessible financial solutions that make achieving their goals easier.</p>
            </div>
            <div className="mvgc rv">
              <div className="mvgico">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="8.5" stroke="#D4AF37" strokeWidth="1.5"/><path d="M11 3.5v3M11 15.5v3M3.5 11h3M15.5 11h3" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round"/><circle cx="11" cy="11" r="2.5" fill="#D4AF37" opacity=".5"/></svg>
              </div>
              <h3>Our Vision</h3>
              <p>To become a trusted fintech company that empowers people to save, manage their finances, and build a more secure financial future.</p>
            </div>
            <div className="mvgc rv">
              <div className="mvgico">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 19l4-8 4 4 4-6 4 2" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="19" cy="5" r="2" fill="#D4AF37" opacity=".6"/></svg>
              </div>
              <h3>Long-Term Goal</h3>
              <p>To build a digital financial platform that helps individuals and entrepreneurs save with ease, access financial tools, and grow through responsible financing and innovative technology.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="ctasec" style={{ padding: "var(--sec) 0" }}>
        <div className="wrap rv">
          <span className="eye">Get Started</span>
          <h2>Ready to start your<br />savings journey?</h2>
          <p>Join over 600 Nigerians who are saving consistently and working towards their financial goals with SHAKASAVE.</p>
          <Link href="/register" className="btn btn-gold" style={{ height: 56, padding: "0 36px", fontSize: 16 }}>
            Start Saving Today
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ marginLeft: 2 }}>
              <path d="M3 7.5h9M8 3.5l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="footg">
            <div className="footbrand">
              <a href="#" style={{ display: "inline-block", lineHeight: 0 }}>
                <Image src={Logo} alt="ShakaSave" width={120} height={64} style={{ objectFit: "contain", width: "auto", height: 64 }} />
              </a>
              <p>Helping Nigerians build the savings habit that leads to financial freedom — one day, one goal, one contribution at a time.</p>
            </div>
            <div className="footcol">
              <h4>Products</h4>
              <ul>
                <li><a href="#">Daily Savings</a></li>
                <li><a href="#">Target Savings</a></li>
                <li><a href="#">Food Bank</a></li>
                <li><a href="#">Esusu</a></li>
                <li><a href="#">Advisory</a></li>
              </ul>
            </div>
            <div className="footcol">
              <h4>Company</h4>
              <ul>
                <li><a href="#about">About Us</a></li>
                <li><a href="#mission">Mission</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="https://wa.me/2348020827133">WhatsApp</a></li>
              </ul>
            </div>
            <div className="footcol">
              <h4>Account</h4>
              <ul>
                <li><Link href="/register">Create account</Link></li>
                <li><Link href="/login">Log in</Link></li>
                <li><a href="#">Help</a></li>
                <li><a href="#">Privacy policy</a></li>
              </ul>
            </div>
          </div>
          <div className="footbtm">
            <p>© 2025 SHAKASAVE Finance. All rights reserved.</p>
            <a href="#">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
