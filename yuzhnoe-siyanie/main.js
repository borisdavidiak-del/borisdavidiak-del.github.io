(() => {
  'use strict';

  const TURQ = [0, 251, 157];
  const BLUE = [53, 79, 227];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
   * Знак-сияние: волнистая лента с бирюзовым телом и синей кромкой,
   * как в логотипе. Рисуется на canvas и живёт во времени.
   * ------------------------------------------------------------------ */
  const MARK_PRESETS = {
    nav:   { base: .78, height: .78, amp: .10, f1: .9, f2: 1.7, speed: .9, shear: .14, fringe: .11, step: 1 },
    hero:  { base: .72, height: .70, amp: .11, f1: .9, f2: 1.6, speed: .55, shear: .12, fringe: .075, step: 1 },
    card:  { base: .76, height: .72, amp: .11, f1: .9, f2: 1.9, speed: .7, shear: .14, fringe: .11, step: 1 },
    band:  { base: .62, height: .58, amp: .10, f1: 0, f2: 0, speed: .35, shear: .10, fringe: .13, step: 2, period: 260, scroll: 40, rays: true },
    drape: { base: .6, height: 1.1, amp: .09, f1: 0, f2: 0, speed: .3, shear: .05, fringe: .03, step: 2, period: 820, scroll: 22, rays: true },
  };

  function waveY(o, u, t, seed, w) {
    if (o.period) {
      // бесшовный фирменный элемент: повторяющийся сегмент, едущий по горизонтали
      const ph = ((u * w + t * o.scroll) / o.period) * Math.PI * 2;
      return Math.sin(ph + seed) * .65 + Math.sin(ph * 2 + 1.3 + t * .6) * .35;
    }
    const a = Math.PI * 2;
    const ph = u * o.f1 * a + t * o.speed + seed;
    // вторая гармоника делает складку резкой, как в знаке
    return Math.sin(ph) * .55 + Math.sin(ph * 2 + .9) * .25 +
           Math.sin(u * o.f2 * a - t * o.speed * 1.4 + seed * 2.1) * .2;
  }

  function drawMark(ctx, w, h, t, o, seed) {
    ctx.clearRect(0, 0, w, h);
    const step = o.step * DPR;
    const H = o.height * h;
    const amp = o.amp * h;
    const base = o.base * h;
    const sh = o.shear * H;            // верх ленты смещён вправо, как в знаке
    const padL = o.period ? -sh : w * .02;
    const padR = o.period ? 0 : w * .02 + sh;
    const span = w - padL - padR;
    const pts = [];
    for (let x = 0; x <= span + step; x += step) {
      const u = x / span;
      pts.push([padL + x, base + amp * waveY(o, u, t, seed, span)]);
    }

    // тело сияния
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const slope = (y1 - y0) / step;
      let light = clamp(.5 + Math.tanh(-slope * 5) * .5, 0, 1);
      if (o.rays) light *= .62 + .38 * (.5 + .5 * Math.sin(x0 * .061 / DPR + t * .9) * Math.sin(x0 * .017 / DPR - t * .35));
      const c = mix([4, 120, 104], TURQ, light);
      ctx.fillStyle = rgba(c);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1 + .6, y1);
      ctx.lineTo(x1 + .6 + sh, y1 - H);
      ctx.lineTo(x0 + sh, y0 - H);
      ctx.fill();
    }
    // мягкое растворение вверх
    ctx.globalCompositeOperation = 'destination-in';
    const top = base - amp - H;
    const g = ctx.createLinearGradient(0, Math.max(top, 0), 0, base + amp);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(.3, 'rgba(0,0,0,.04)');
    g.addColorStop(.62, 'rgba(0,0,0,.32)');
    g.addColorStop(.84, 'rgba(0,0,0,.8)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // синяя кромка под лентой
    ctx.globalCompositeOperation = 'destination-over';
    const ox = o.fringe * h * .55;
    const oy = o.fringe * h;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const slope = (y1 - y0) / step;
      const light = clamp(.5 + Math.tanh(-slope * 3) * .5, 0, 1);
      ctx.fillStyle = rgba(mix([34, 50, 150], BLUE, light));
      ctx.beginPath();
      ctx.moveTo(x0 + ox, y0 + oy);
      ctx.lineTo(x1 + ox + .6, y1 + oy);
      ctx.lineTo(x1 + ox + .6, y1 - oy);
      ctx.lineTo(x0 + ox, y0 - oy);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const marks = [...document.querySelectorAll('canvas.mark')].map((cv) => {
    const o = MARK_PRESETS[cv.dataset.mark];
    const seed = (+cv.dataset.seed || 0) * 1.7;
    const m = { cv, ctx: cv.getContext('2d'), o, seed, visible: true, w: 0, h: 0 };
    const io = new IntersectionObserver(([e]) => { m.visible = e.isIntersecting; });
    io.observe(cv);
    return m;
  });

  function sizeMarks() {
    for (const m of marks) {
      const r = m.cv.getBoundingClientRect();
      m.w = m.cv.width = Math.max(1, Math.round(r.width * DPR));
      m.h = m.cv.height = Math.max(1, Math.round(r.height * DPR));
    }
  }
  // сразу рисуем каждый знак, даже за пределами экрана, чтобы он не был пустым
  const paintAll = () => marks.forEach((m) => drawMark(m.ctx, m.w, m.h, reduced ? 24 : performance.now() / 1000, m.o, m.seed));
  sizeMarks();
  paintAll();
  addEventListener('resize', () => { sizeMarks(); paintAll(); });

  /* ------------------------------------------------------------------
   * Небо первого экрана: WebGL-шейдер северного сияния.
   * ------------------------------------------------------------------ */
  const aurora = (() => {
    const cv = document.getElementById('aurora');
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) { document.documentElement.classList.add('no-webgl'); return null; }

    const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
    const fs = `
precision highp float;
uniform vec2 uRes; uniform float uT; uniform vec2 uMouse; uniform float uBoost;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float asp=uRes.x/uRes.y;
  vec2 p=vec2(uv.x*asp,uv.y);
  vec3 turq=vec3(0.,.984,.616), blue=vec3(.208,.31,.89), ink=vec3(.106,.137,.216);
  vec3 col=mix(ink*1.05,ink*.45,smoothstep(.0,1.,uv.y));

  // звёзды
  vec2 cell=floor(gl_FragCoord.xy/3.);
  float h=hash(cell);
  float star=step(.9965,h)*(.45+.55*sin(uT*(1.5+h*3.)+h*90.));
  col+=vec3(.85,.95,1.)*star*smoothstep(.25,.9,uv.y)*.9;

  float hue=.5+.5*sin(uT*.07);
  vec3 aur=vec3(0.);
  for(int i=0;i<3;i++){
    float fi=float(i);
    float x=p.x*(.85+fi*.4)+fi*3.1;
    float dm=uMouse.x*asp-p.x;
    float edge=.36+fi*.11
      +.5*(fbm(vec2(x*.55-uT*(.035+fi*.012),fi*1.7+uT*.025))-.5)
      +.045*sin(x*2.3+uT*.45+fi*2.);
    edge+=.08*exp(-dm*dm*6.)*(uMouse.y-.45);
    float d=uv.y-edge;
    float rays=fbm(vec2(x*10.+d*2.8,uT*.18+fi*7.));
    rays=.25+1.5*pow(rays,2.3);
    float fold=.6+.4*sin(x*5.+6.*fbm(vec2(x*1.7,uT*.08+fi)));
    float curtain=smoothstep(-.01,.006,d)*exp(-max(d,0.)*(3.+fi*1.6));
    float fringe=exp(-pow((d+.016)/.009,2.));
    float halo=exp(-abs(d)*6.)*.22;
    vec3 c=mix(turq,mix(turq,blue,.6),fi*.5);
    c=mix(c,mix(c,blue,.45),hue*.5);
    aur+=(c*curtain*rays*fold*1.15+blue*fringe*.55*rays*fold+c*halo)/(1.+fi*.55);
  }
  aur*=.8+.9*uBoost;
  col+=aur;
  col=1.-exp(-col*1.2);
  // лёгкое зерно, чтобы градиенты не полосили
  col+=(hash(gl_FragCoord.xy+uT)-.5)*.012;
  gl_FragColor=vec4(col,1.);
}`;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) {
      console.warn(err);
      document.documentElement.classList.add('no-webgl');
      return null;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const uRes = U('uRes'), uT = U('uT'), uMouse = U('uMouse'), uBoost = U('uBoost');

    const state = { mx: .5, my: .5, tx: .5, ty: .5, boost: 0, visible: true };
    const scale = Math.min(DPR, 1.5) * (innerWidth > 1600 ? .7 : .85);
    function resize() {
      cv.width = Math.round(cv.clientWidth * scale);
      cv.height = Math.round(cv.clientHeight * scale);
      gl.viewport(0, 0, cv.width, cv.height);
    }
    resize();
    addEventListener('resize', resize);
    new IntersectionObserver(([e]) => { state.visible = e.isIntersecting; }).observe(cv);

    const hero = cv.parentElement;
    hero.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      state.tx = (e.clientX - r.left) / r.width;
      state.ty = 1 - (e.clientY - r.top) / r.height;
    });
    hero.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a')) return;
      state.boost = 1;
      sparks.burst(e.clientX, e.clientY, 46);
    });

    return {
      state,
      render(t, dt) {
        if (!state.visible) return;
        state.mx += (state.tx - state.mx) * Math.min(1, dt * 2.5);
        state.my += (state.ty - state.my) * Math.min(1, dt * 2.5);
        state.boost *= Math.pow(.25, dt);
        gl.uniform2f(uRes, cv.width, cv.height);
        gl.uniform1f(uT, t);
        gl.uniform2f(uMouse, state.mx, state.my);
        gl.uniform1f(uBoost, state.boost);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  })();

  /* ------------------------------------------------------------------
   * Искры за курсором.
   * ------------------------------------------------------------------ */
  const sparks = (() => {
    const cv = document.getElementById('sparks');
    const ctx = cv.getContext('2d');
    const list = [];
    function resize() { cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; }
    resize();
    addEventListener('resize', resize);
    function add(x, y, vx, vy, life) {
      if (list.length > 400) list.shift();
      list.push({
        x, y, vx, vy, life, max: life,
        r: 1 + Math.random() * 2.4,
        c: Math.random() < .7 ? TURQ : (Math.random() < .5 ? BLUE : [255, 255, 255]),
      });
    }
    let lx = null, ly = null;
    if (!reduced && matchMedia('(pointer: fine)').matches) {
      addEventListener('pointermove', (e) => {
        if (lx !== null) {
          const d = Math.hypot(e.clientX - lx, e.clientY - ly);
          const n = Math.min(4, Math.floor(d / 8));
          for (let i = 0; i < n; i++) {
            add(e.clientX + (Math.random() - .5) * 6, e.clientY + (Math.random() - .5) * 6,
              (Math.random() - .5) * 30, -10 - Math.random() * 40, .6 + Math.random() * .6);
          }
        }
        lx = e.clientX; ly = e.clientY;
      });
    }
    return {
      burst(x, y, n) {
        if (reduced) return;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 260;
          add(x, y, Math.cos(a) * s, Math.sin(a) * s - 60, .8 + Math.random() * .9);
        }
      },
      render(dt) {
        ctx.clearRect(0, 0, cv.width, cv.height);
        if (!list.length) return;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.life -= dt;
          if (p.life <= 0) { list.splice(i, 1); continue; }
          p.vx *= Math.pow(.2, dt); p.vy = p.vy * Math.pow(.3, dt) - 12 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const k = p.life / p.max;
          const r = p.r * DPR * (0.4 + k);
          ctx.fillStyle = rgba(p.c, k * .9);
          ctx.beginPath();
          ctx.arc(p.x * DPR, p.y * DPR, r, 0, 7);
          ctx.fill();
          ctx.fillStyle = rgba(p.c, k * .15);
          ctx.beginPath();
          ctx.arc(p.x * DPR, p.y * DPR, r * 4, 0, 7);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  })();

  /* ------------------------------------------------------------------
   * Небо, на котором можно рисовать сияние.
   * ------------------------------------------------------------------ */
  const play = (() => {
    const cv = document.getElementById('playground');
    const ctx = cv.getContext('2d');
    const empty = document.getElementById('playEmpty');
    let w = 0, h = 0, visible = false, mode = 'green', touched = false, demoDone = false;
    const pts = [];       // {x, y, born, c, seed}
    let hueShift = 0;

    // вертикальные спрайты лучей: яркий низ, прозрачный верх
    function sprite(c) {
      const s = document.createElement('canvas');
      s.width = 4; s.height = 256;
      const g = s.getContext('2d');
      const gr = g.createLinearGradient(0, 256, 0, 0);
      gr.addColorStop(0, rgba(c, 1));
      gr.addColorStop(.12, rgba(c, .75));
      gr.addColorStop(.5, rgba(c, .25));
      gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
      return s;
    }
    const sprites = Array.from({ length: 9 }, (_, i) => sprite(mix(TURQ, BLUE, i / 8)));

    function resize() {
      const r = cv.getBoundingClientRect();
      w = cv.width = Math.round(r.width * DPR);
      h = cv.height = Math.round(r.height * DPR);
    }
    resize();
    addEventListener('resize', resize);

    function colorIndex() {
      if (mode === 'green') return Math.floor(Math.random() * 2);
      if (mode === 'blue') return 6 + Math.floor(Math.random() * 3);
      hueShift += .012;
      return Math.round((Math.sin(hueShift) * .5 + .5) * 8);
    }
    let last = null;
    function addPoint(x, y, now) {
      if (last) {
        const d = Math.hypot(x - last.x, y - last.y);
        const n = Math.floor(d / (3 * DPR));
        for (let i = 1; i <= n; i++) {
          const k = i / n;
          push(last.x + (x - last.x) * k, last.y + (y - last.y) * k, now);
        }
        if (n) last = { x, y };
      } else {
        push(x, y, now); last = { x, y };
      }
    }
    function push(x, y, now) {
      pts.push({ x, y, born: now, c: colorIndex(), seed: Math.random() * 100 });
      if (pts.length > 5000) pts.splice(0, pts.length - 5000);
    }

    let drawing = false;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) * DPR, (e.clientY - r.top) * DPR];
    };
    cv.addEventListener('pointerdown', (e) => {
      drawing = true; last = null; cv.setPointerCapture(e.pointerId);
      if (!touched) { touched = true; empty.classList.add('is-gone'); }
      addPoint(...pos(e), performance.now() / 1000);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      addPoint(...pos(e), performance.now() / 1000);
      if (Math.random() < .25) sparks.burst(e.clientX, e.clientY, 2);
    });
    const stop = () => { drawing = false; last = null; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);

    document.querySelectorAll('.chip[data-hue]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-hue]').forEach((x) => x.classList.toggle('is-on', x === b));
      mode = b.dataset.hue;
    }));
    document.getElementById('clearSky').addEventListener('click', () => { pts.length = 0; });

    // сама рисует первую ленту, когда секция впервые появляется на экране
    function demo() {
      if (demoDone) return;
      demoDone = true;
      const t0 = performance.now();
      const run = () => {
        const k = Math.min(1, (performance.now() - t0) / 1600);
        const x = w * (.12 + .76 * k);
        const y = h * (.62 + .1 * Math.sin(k * Math.PI * 2.4));
        addPoint(x, y, performance.now() / 1000);
        if (k < 1) requestAnimationFrame(run); else last = null;
      };
      run();
    }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && e.intersectionRatio > .4) demo();
    }, { threshold: [0, .4] }).observe(cv);

    return {
      render(t) {
        if (!visible) return;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        const H = h * .42;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const age = t - p.born;
          const grow = clamp(age / .5, 0, 1);
          const life = 1 - clamp((age - 14) / 8, 0, .55);   // со временем тускнеет, но не гаснет совсем
          const ray = .45 + .55 * Math.pow(.5 + .5 * Math.sin(p.seed + t * 1.3 + i * .21), 3);
          const sway = Math.sin(t * .8 + p.x * .004) * 6 * DPR;
          const hh = H * (.55 + .45 * Math.sin(p.seed * 3 + t * .5) ** 2) * grow;
          ctx.globalAlpha = .34 * ray * life;
          ctx.drawImage(sprites[p.c], p.x + sway * .3, p.y - hh, 3.2 * DPR, hh);
          // синяя кромка снизу
          ctx.globalAlpha = .22 * life * grow;
          ctx.drawImage(sprites[8], p.x + sway * .3 + 2 * DPR, p.y + 2 * DPR, 3 * DPR, 7 * DPR);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      },
    };
  })();

  /* ------------------------------------------------------------------
   * Мелочи интерфейса: буквы, появление, счётчики, наклон карточек.
   * ------------------------------------------------------------------ */
  document.querySelectorAll('.split').forEach((el) => {
    const text = el.textContent;
    el.textContent = '';
    let i = 0;
    text.split(' ').forEach((word, wi) => {
      if (wi) el.append(' ');
      const wrap = document.createElement('span');
      wrap.className = 'word';
      for (const ch of word) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--i', i++);
        s.textContent = ch;
        s.setAttribute('aria-hidden', 'true');
        wrap.appendChild(s);
      }
      el.appendChild(wrap);
      i++;
    });
    el.addEventListener('animationend', (e) => e.target.classList.contains('ch') && (e.target.style.opacity = 1));
  });

  function countUp(el) {
    const to = +el.dataset.count;
    const from = to > 1000 ? to - 40 : 0;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1600);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  const revealIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      e.target.querySelectorAll('[data-count]').forEach(countUp);
      revealIO.unobserve(e.target);
    }
  }, { threshold: .18 });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    if (el.classList.contains('card')) el.style.transitionDelay = `0s, 0s, ${(i % 4) * .12}s`;
    revealIO.observe(el);
  });

  document.querySelectorAll('.card').forEach((c) => {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', `${x * 100}%`);
      c.style.setProperty('--my', `${y * 100}%`);
      if (!reduced) {
        c.style.setProperty('--ry', `${(x - .5) * 10}deg`);
        c.style.setProperty('--rx', `${(.5 - y) * 10}deg`);
      }
    });
    c.addEventListener('pointerleave', () => {
      c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg');
    });
  });

  document.querySelectorAll('.btn--glow').forEach((b) => b.addEventListener('pointermove', (e) => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--x', `${e.clientX - r.left}px`);
    b.style.setProperty('--y', `${e.clientY - r.top}px`);
  }));

  document.querySelectorAll('a[aria-disabled="true"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------
   * Общий цикл анимации.
   * ------------------------------------------------------------------ */
  let prev = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - prev) / 1000);
    prev = now;
    // при «уменьшить движение» сияние застывает в одном красивом кадре
    const t = reduced ? 24 : now / 1000;
    if (aurora) aurora.render(t, dt);
    for (const m of marks) if (m.visible && m.w > 1) drawMark(m.ctx, m.w, m.h, t, m.o, m.seed);
    sparks.render(dt);
    play.render(now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
