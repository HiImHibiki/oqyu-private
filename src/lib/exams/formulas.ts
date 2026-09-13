/* Formula sheet / reference sheet yang muncul di dalam ujian.
 * `tex` dirender dengan KaTeX. `note` opsional (keterangan singkat). */

export interface FormulaItem { tex: string; note?: string; }
export interface FormulaGroup { title: string; items: FormulaItem[]; }
export interface FormulaSheet { id: string; title: string; subtitle?: string; groups: FormulaGroup[]; }

export const FORMULA_SHEETS: Record<string, FormulaSheet> = {
  /* ------------------------------- SAT ---------------------------------- */
  sat_math: {
    id: "sat_math",
    title: "SAT Math Reference",
    subtitle: "Identical to the Bluebook reference sheet",
    groups: [
      {
        title: "Area & Circumference",
        items: [
          { tex: "A = \\pi r^{2}" },
          { tex: "C = 2\\pi r" },
          { tex: "A = \\ell w" },
          { tex: "A = \\tfrac{1}{2} b h" },
        ],
      },
      {
        title: "Triangles",
        items: [
          { tex: "c^{2} = a^{2} + b^{2}", note: "Pythagorean theorem" },
          { tex: "30^\\circ\\text{-}60^\\circ\\text{-}90^\\circ:\; x,\; x\\sqrt{3},\; 2x" },
          { tex: "45^\\circ\\text{-}45^\\circ\\text{-}90^\\circ:\; s,\; s,\; s\\sqrt{2}" },
        ],
      },
      {
        title: "Volume",
        items: [
          { tex: "V = \\ell w h" },
          { tex: "V = \\pi r^{2} h" },
          { tex: "V = \\tfrac{4}{3}\\pi r^{3}" },
          { tex: "V = \\tfrac{1}{3}\\pi r^{2} h" },
          { tex: "V = \\tfrac{1}{3} \\ell w h" },
        ],
      },
      {
        title: "Facts",
        items: [
          { tex: "\\text{The number of degrees of arc in a circle is } 360." },
          { tex: "\\text{The number of radians of arc in a circle is } 2\\pi." },
          { tex: "\\text{The sum of the measures in degrees of the angles of a triangle is } 180." },
        ],
      },
    ],
  },

  /* ------------------------------- UTBK --------------------------------- */
  utbk_math: {
    id: "utbk_math",
    title: "Daftar Rumus — Penalaran Matematika & PK",
    subtitle: "Referensi Exact (UTBK resmi tidak menyediakan lembar rumus)",
    groups: [
      {
        title: "Aljabar",
        items: [
          { tex: "ax^{2}+bx+c=0 \\Rightarrow x=\\dfrac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}" },
          { tex: "x_1+x_2=-\\dfrac{b}{a},\\quad x_1x_2=\\dfrac{c}{a}" },
          { tex: "a^{m}\\cdot a^{n}=a^{m+n},\\quad (a^{m})^{n}=a^{mn}" },
          { tex: "{}^{a}\\log b + {}^{a}\\log c = {}^{a}\\log(bc)" },
        ],
      },
      {
        title: "Barisan & Deret",
        items: [
          { tex: "U_n = a+(n-1)b,\\quad S_n=\\tfrac{n}{2}\\,(2a+(n-1)b)" },
          { tex: "U_n = ar^{\\,n-1},\\quad S_n=\\dfrac{a(r^{n}-1)}{r-1}" },
          { tex: "S_\\infty=\\dfrac{a}{1-r},\; |r|<1" },
        ],
      },
      {
        title: "Geometri",
        items: [
          { tex: "L_{\\text{lingkaran}}=\\pi r^{2},\\quad K=2\\pi r" },
          { tex: "V_{\\text{tabung}}=\\pi r^{2}t,\\quad V_{\\text{kerucut}}=\\tfrac13\\pi r^{2}t" },
          { tex: "V_{\\text{bola}}=\\tfrac43\\pi r^{3},\\quad L_{\\text{bola}}=4\\pi r^{2}" },
          { tex: "\\text{Jarak: } d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}" },
        ],
      },
      {
        title: "Trigonometri",
        items: [
          { tex: "\\sin^{2}\\alpha+\\cos^{2}\\alpha=1" },
          { tex: "\\dfrac{a}{\\sin A}=\\dfrac{b}{\\sin B}=\\dfrac{c}{\\sin C}" },
          { tex: "a^{2}=b^{2}+c^{2}-2bc\\cos A" },
          { tex: "L_{\\triangle}=\\tfrac12 ab\\sin C" },
        ],
      },
      {
        title: "Statistika & Peluang",
        items: [
          { tex: "\\bar{x}=\\dfrac{\\sum x_i}{n}" },
          { tex: "s^{2}=\\dfrac{\\sum (x_i-\\bar{x})^{2}}{n-1}" },
          { tex: "P(A\\cup B)=P(A)+P(B)-P(A\\cap B)" },
          { tex: "{}^{n}C_r=\\dfrac{n!}{r!(n-r)!},\\quad {}^{n}P_r=\\dfrac{n!}{(n-r)!}" },
        ],
      },
    ],
  },

  /* ------------------------------- CSCA --------------------------------- */
  csca_math: {
    id: "csca_math",
    title: "Mathematics Formula Sheet 数学公式表",
    groups: [
      {
        title: "Algebra 代数",
        items: [
          { tex: "(a\\pm b)^{3}=a^{3}\\pm3a^{2}b+3ab^{2}\\pm b^{3}" },
          { tex: "\\sum_{k=1}^{n}k=\\dfrac{n(n+1)}{2},\\quad \\sum_{k=1}^{n}k^{2}=\\dfrac{n(n+1)(2n+1)}{6}" },
          { tex: "|z|=\\sqrt{a^{2}+b^{2}},\\quad z\\bar z=|z|^{2}" },
        ],
      },
      {
        title: "Calculus 微积分",
        items: [
          { tex: "(uv)'=u'v+uv',\\quad \\left(\\dfrac{u}{v}\\right)'=\\dfrac{u'v-uv'}{v^{2}}" },
          { tex: "\\int x^{n}dx=\\dfrac{x^{n+1}}{n+1}+C\;(n\\neq-1)" },
          { tex: "\\int_a^b f(x)\\,dx = F(b)-F(a)" },
          { tex: "\\lim_{x\\to0}\\dfrac{\\sin x}{x}=1" },
        ],
      },
      {
        title: "Conic Sections 圆锥曲线",
        items: [
          { tex: "\\dfrac{x^{2}}{a^{2}}+\\dfrac{y^{2}}{b^{2}}=1,\\quad e=\\dfrac{c}{a},\; c^{2}=a^{2}-b^{2}" },
          { tex: "\\dfrac{x^{2}}{a^{2}}-\\dfrac{y^{2}}{b^{2}}=1,\\quad c^{2}=a^{2}+b^{2}" },
          { tex: "y^{2}=2px,\\quad \\text{focus }\\left(\\tfrac{p}{2},0\\right)" },
        ],
      },
      {
        title: "Probability & Statistics 概率统计",
        items: [
          { tex: "P(A\\mid B)=\\dfrac{P(AB)}{P(B)}" },
          { tex: "X\\sim B(n,p):\; P(X=k)={}^{n}C_k p^{k}(1-p)^{n-k}" },
          { tex: "E(X)=np,\\quad D(X)=np(1-p)" },
        ],
      },
      {
        title: "Solid Geometry 立体几何",
        items: [
          { tex: "V_{\\text{prism}}=Sh,\\quad V_{\\text{pyramid}}=\\tfrac13Sh" },
          { tex: "S_{\\text{sphere}}=4\\pi R^{2},\\quad V_{\\text{sphere}}=\\tfrac43\\pi R^{3}" },
        ],
      },
    ],
  },
  csca_physics: {
    id: "csca_physics",
    title: "Physics Formula Sheet 物理公式表",
    subtitle: "Selaras dengan silabus CSCA resmi edisi 2025",
    groups: [
      {
        title: "Mechanics 力学",
        items: [
          { tex: "v=u+at,\\quad s=ut+\\tfrac12at^{2},\\quad v^{2}=u^{2}+2as" },
          { tex: "F=ma,\\quad p=mv,\\quad F\\Delta t=\\Delta p", note: "Newton & impuls-momentum" },
          { tex: "W=Fs\\cos\\theta,\\quad P=\\dfrac{W}{t}=Fv" },
          { tex: "E_k=\\tfrac12mv^{2},\\quad E_p=mgh,\\quad E_p=\\tfrac12kx^{2}" },
          { tex: "a_c=\\dfrac{v^{2}}{r}=\\omega^{2}r,\\quad F_c=\\dfrac{mv^{2}}{r}" },
          { tex: "T=2\\pi\\sqrt{\\dfrac{m}{k}},\\quad T=2\\pi\\sqrt{\\dfrac{l}{g}}", note: "简谐运动" },
        ],
      },
      {
        title: "Electromagnetism 电磁学",
        items: [
          { tex: "F=k\\dfrac{q_1q_2}{r^{2}},\\quad k=9.0\\times10^{9}\\ \\mathrm{N\\,m^{2}\\,C^{-2}}" },
          { tex: "E=\\dfrac{F}{q},\\quad U=Ed,\\quad C=\\dfrac{Q}{U}" },
          { tex: "V=IR,\\quad P=VI=I^{2}R,\\quad R=\\rho\\dfrac{L}{S}" },
          { tex: "R_s=\\sum R_i,\\quad \\dfrac{1}{R_p}=\\sum\\dfrac{1}{R_i}" },
          { tex: "F=BIL\\sin\\theta,\\quad F=qvB\\sin\\theta", note: "gaya magnet & Lorentz" },
          { tex: "\\varepsilon=-N\\dfrac{\\Delta\\Phi}{\\Delta t},\\quad \\varepsilon=BLv", note: "法拉第 & 楞次" },
        ],
      },
      {
        title: "Thermodynamics 热学",
        items: [
          { tex: "pV=nRT,\\quad \\dfrac{p_1V_1}{T_1}=\\dfrac{p_2V_2}{T_2}" },
          { tex: "\\Delta U=Q+W", note: "热力学第一定律" },
          { tex: "\\bar{E}_k=\\tfrac32kT,\\quad k=1.38\\times10^{-23}\\ \\mathrm{J\\,K^{-1}}" },
        ],
      },
      {
        title: "Optics 光学",
        items: [
          { tex: "n_1\\sin\\theta_1=n_2\\sin\\theta_2", note: "斯涅尔定律" },
          { tex: "n=\\dfrac{c}{v},\\quad \\sin C=\\dfrac{1}{n}", note: "全反射临界角" },
          { tex: "\\Delta y=\\dfrac{L\\lambda}{d}", note: "双缝干涉条纹间距" },
        ],
      },
      {
        title: "Modern Physics 近代物理",
        items: [
          { tex: "E=h\\nu,\\quad h=6.63\\times10^{-34}\\ \\mathrm{J\\,s}" },
          { tex: "h\\nu=W_0+E_{k,\\max}", note: "光电效应方程" },
          { tex: "E=mc^{2},\\quad c=3.0\\times10^{8}\\ \\mathrm{m\\,s^{-1}}" },
          { tex: "N=N_0\\left(\\tfrac12\\right)^{t/T_{1/2}}", note: "衰变规律" },
        ],
      },
      {
        title: "Constants 常量",
        items: [
          { tex: "g=9.8\\ \\mathrm{m\\,s^{-2}},\\quad G=6.67\\times10^{-11}\\ \\mathrm{N\\,m^{2}\\,kg^{-2}}" },
          { tex: "e=1.6\\times10^{-19}\\ \\mathrm{C},\\quad N_A=6.02\\times10^{23}\\ \\mathrm{mol^{-1}}" },
        ],
      },
    ],
  },
  csca_chemistry: {
    id: "csca_chemistry",
    title: "Chemistry Formula Sheet 化学公式表",
    subtitle: "Selaras dengan silabus CSCA resmi edisi 2025",
    groups: [
      {
        title: "Basic Concepts 基本概念",
        items: [
          { tex: "n=\\dfrac{m}{M}=\\dfrac{N}{N_A}=\\dfrac{V}{V_m}" },
          { tex: "V_m=22.4\\ \\mathrm{L\\,mol^{-1}}\\ (\\text{STP}),\\quad pV=nRT" },
          { tex: "c=\\dfrac{n}{V},\\quad c_1V_1=c_2V_2", note: "pengenceran" },
          { tex: "w=\\dfrac{m_{\\text{zat}}}{m_{\\text{larutan}}}\\times100\\%" },
        ],
      },
      {
        title: "Acids, Bases & Solutions 酸碱与溶液",
        items: [
          { tex: "pH=-\\log[\\mathrm{H^{+}}],\\quad pOH=-\\log[\\mathrm{OH^{-}}]" },
          { tex: "K_w=[\\mathrm{H^{+}}][\\mathrm{OH^{-}}]=1.0\\times10^{-14}\\ (25^{\\circ}\\mathrm{C})" },
          { tex: "pH+pOH=14\\ (25^{\\circ}\\mathrm{C})" },
          { tex: "K_a=\\dfrac{[\\mathrm{H^{+}}][\\mathrm{A^{-}}]}{[\\mathrm{HA}]},\\quad K_{sp}=[\\mathrm{A}]^{a}[\\mathrm{B}]^{b}" },
        ],
      },
      {
        title: "Equilibrium & Kinetics 平衡与速率",
        items: [
          { tex: "K_c=\\dfrac{[\\mathrm{C}]^{c}[\\mathrm{D}]^{d}}{[\\mathrm{A}]^{a}[\\mathrm{B}]^{b}}" },
          { tex: "v=\\dfrac{\\Delta c}{\\Delta t}", note: "laju reaksi rata-rata" },
          { tex: "\\text{Le Chatelier: 增大压强平衡向气体分子数减少的方向移动}" },
        ],
      },
      {
        title: "Thermochemistry & Electrochemistry 热化学与电化学",
        items: [
          { tex: "\\Delta H=\\sum E_{\\text{ikatan putus}}-\\sum E_{\\text{ikatan bentuk}}" },
          { tex: "\\Delta H=\\sum\\Delta H_f(\\text{produk})-\\sum\\Delta H_f(\\text{reaktan})", note: "hukum Hess" },
          { tex: "Q=It,\\quad n_{e^-}=\\dfrac{Q}{F},\\quad F=96500\\ \\mathrm{C\\,mol^{-1}}" },
        ],
      },
    ],
  },

  /* ------------------------------ A LEVEL ------------------------------- */
  alevel_mf19: {
    id: "alevel_mf19",
    title: "MF19 — Mathematics List of Formulae",
    subtitle: "Ekstrak bagian Pure Mathematics 1",
    groups: [
      {
        title: "Algebra",
        items: [
          { tex: "(a+b)^{n}=a^{n}+{}^{n}C_1a^{n-1}b+\\cdots+b^{n}" },
          { tex: "S_n=\\tfrac{n}{2}\\{2a+(n-1)d\\}" },
          { tex: "S_n=\\dfrac{a(1-r^{n})}{1-r},\\quad S_\\infty=\\dfrac{a}{1-r}\;(|r|<1)" },
        ],
      },
      {
        title: "Trigonometry",
        items: [
          { tex: "\\tan\\theta\\equiv\\dfrac{\\sin\\theta}{\\cos\\theta}" },
          { tex: "\\sin^{2}\\theta+\\cos^{2}\\theta\\equiv1" },
          { tex: "s=r\\theta,\\quad A=\\tfrac12r^{2}\\theta" },
        ],
      },
      {
        title: "Calculus",
        items: [
          { tex: "\\dfrac{d}{dx}(x^{n})=nx^{n-1}" },
          { tex: "\\int x^{n}dx=\\dfrac{x^{n+1}}{n+1}+c" },
          { tex: "V=\\pi\\int_a^b y^{2}\\,dx" },
        ],
      },
    ],
  },
  alevel_physics: {
    id: "alevel_physics",
    title: "9702 Data & Formulae",
    groups: [
      {
        title: "Data",
        items: [
          { tex: "g = 9.81\\ \\mathrm{m\\,s^{-2}}" },
          { tex: "c = 3.00\\times10^{8}\\ \\mathrm{m\\,s^{-1}}" },
          { tex: "e = 1.60\\times10^{-19}\\ \\mathrm{C}" },
          { tex: "h = 6.63\\times10^{-34}\\ \\mathrm{J\\,s}" },
        ],
      },
      {
        title: "Formulae",
        items: [
          { tex: "s = ut + \\tfrac12at^{2},\\quad v^{2}=u^{2}+2as" },
          { tex: "W = p\\,\\Delta V" },
          { tex: "\\text{Resistors in series } R = R_1+R_2+\\cdots" },
          { tex: "\\text{Doppler } f_o=\\dfrac{f_s v}{v\\pm v_s}" },
        ],
      },
    ],
  },
  alevel_chem: {
    id: "alevel_chem",
    title: "9701 Data Booklet (ekstrak)",
    groups: [
      {
        title: "Constants",
        items: [
          { tex: "N_A = 6.02\\times10^{23}\\ \\mathrm{mol^{-1}}" },
          { tex: "R = 8.31\\ \\mathrm{J\\,K^{-1}\\,mol^{-1}}" },
          { tex: "V_m = 24.0\\ \\mathrm{dm^{3}\\,mol^{-1}}\\ (298\\,\\mathrm{K},\\ 1\\,\\mathrm{atm})" },
        ],
      },
      {
        title: "Equations",
        items: [
          { tex: "pV = nRT" },
          { tex: "K_w=[\\mathrm{H^{+}}][\\mathrm{OH^{-}}]=1.00\\times10^{-14}\\ \\mathrm{mol^{2}\\,dm^{-6}}" },
          { tex: "\\Delta G^{\\ominus}=\\Delta H^{\\ominus}-T\\Delta S^{\\ominus}" },
        ],
      },
    ],
  },
};

export function getSheet(id?: string) {
  return id ? FORMULA_SHEETS[id] : undefined;
}
