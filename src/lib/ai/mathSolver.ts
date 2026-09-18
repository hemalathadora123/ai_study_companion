/**
 * Dedicated Mathematics Problem Solver and Pedagogical Concept Engine.
 * Enables the AI Tutor to:
 * 1. Solve math problems step-by-step with complete whiteboard workings.
 * 2. Deliver deep, intuitive conceptual explanations for theoretical questions.
 * 3. Differentiate between problem-solving requests and conceptual requests.
 */

export interface MathSolutionResult {
  isHandled: boolean;
  text: string;
}

/**
 * Checks if the user's question is asking to solve a mathematical problem.
 */
export function isMathProblemQuery(query: string): boolean {
  const q = query.toLowerCase();

  // Obvious solve/calculate indicators
  const solveKeywords = [
    "find the derivative",
    "calculate the derivative",
    "differentiate the function",
    "differentiate",
    "what is the derivative of",
    "solve",
    "evaluate the derivative",
    "compute the derivative",
    "derive the function",
    "derivative of the function",
    "derivative of",
    "f'(x)",
    "dy/dx",
    "d/dx",
  ];

  const hasSolveKeyword = solveKeywords.some((kw) => q.includes(kw));
  // Check for presence of polynomial or functional expressions like f(x) = ..., 3x2, 3x^2, etc.
  const hasFunctionPattern =
    /f\s*\(\s*x\s*\)\s*=/i.test(query) ||
    /y\s*=\s*/i.test(query) ||
    /\d*\s*x\s*(?:\^|\b\d|\*)/i.test(query) ||
    /\b(?:sin|cos|tan|ln|exp)\s*\(/i.test(query);

  // Exclude purely conceptual questions
  const isPureConcept =
    q.startsWith("explain me the differentiation") ||
    q.startsWith("explain differentiation") ||
    q.startsWith("what is differentiation") ||
    q === "explain differentiation" ||
    q === "what is a derivative" ||
    q.includes("concept of differentiation");

  if (isPureConcept && !hasFunctionPattern) {
    return false;
  }

  return hasSolveKeyword || (hasFunctionPattern && !isPureConcept);
}

/**
 * Solves mathematical differentiation problems step-by-step or explains calculus concepts.
 */
export function solveOrExplainMath(
  query: string,
  materialTitle: string = "Course Material",
  pageNumber: number = 1
): MathSolutionResult {
  const qLower = query.toLowerCase();
  const isProblem = isMathProblemQuery(query);

  // If this is a conceptual inquiry (or not a problem-solving question), handle concepts first
  if (!isProblem) {
    if (
      qLower.includes("differentiat") ||
      qLower.includes("derivative") ||
      qLower.includes("what is differentiation") ||
      qLower.includes("what is a derivative")
    ) {
      return {
        isHandled: true,
        text: getDifferentiationConceptExplanation(materialTitle, pageNumber),
      };
    }

    if (qLower.includes("integral") || qLower.includes("integration") || qLower.includes("area under")) {
      return {
        isHandled: true,
        text: getIntegrationConceptExplanation(materialTitle, pageNumber),
      };
    }

    if (qLower.includes("limit") || qLower.includes("continuity")) {
      return {
        isHandled: true,
        text: getLimitsConceptExplanation(materialTitle, pageNumber),
      };
    }

    if (qLower.includes("chain rule")) {
      return {
        isHandled: true,
        text: getChainRuleConceptExplanation(materialTitle, pageNumber),
      };
    }

    if (qLower.includes("product rule") || qLower.includes("quotient rule")) {
      return {
        isHandled: true,
        text: getProductQuotientRuleExplanation(materialTitle, pageNumber),
      };
    }
  }

  // 1. CHECK FOR POLYNOMIAL DIFFERENTIATION PROBLEM (e.g. f(x) = 3x^2 + 4x - 2 or 3x2 + 4x - 2)
  const polynomialSolution = trySolvePolynomialDerivative(query, materialTitle, pageNumber);
  if (polynomialSolution) {
    return { isHandled: true, text: polynomialSolution };
  }

  // 2. CHECK FOR TRIGONOMETRIC / EXPONENTIAL / LOGARITHMIC DERIVATIVES
  const specialDerivativeSolution = trySolveSpecialDerivative(query, materialTitle, pageNumber);
  if (specialDerivativeSolution) {
    return { isHandled: true, text: specialDerivativeSolution };
  }

  // 3. Fallback to concept explanations if query mentioned calculus terms
  if (
    qLower.includes("differentiat") ||
    qLower.includes("derivative") ||
    qLower.includes("what is differentiation")
  ) {
    return {
      isHandled: true,
      text: getDifferentiationConceptExplanation(materialTitle, pageNumber),
    };
  }

  // Not specifically handled by math engine
  return { isHandled: false, text: "" };
}

/**
 * Parses and solves polynomial derivatives step-by-step.
 */
function trySolvePolynomialDerivative(
  query: string,
  materialTitle: string,
  pageNumber: number
): string | null {
  let clean = query;

  // Normalize common notation: replace "3x2" with "3x^2", "5x3" with "5x^3"
  clean = clean.replace(/([0-9]+(?:\.[0-9]+)?)x([0-9]+)/gi, "$1x^$2");
  // Also handle bare "x2" -> "x^2"
  clean = clean.replace(/(?<![a-zA-Z])x([0-9]+)/gi, "x^$1");

  // Extract expression after '=' if present (e.g. f(x) = 3x^2 + 4x - 2 or y = 3x^2 + 4x - 2)
  let expr = clean;
  if (clean.includes("=")) {
    expr = clean.slice(clean.indexOf("=") + 1).trim();
  } else {
    const funcMatch = clean.match(/(?:derivative\s+of\s+(?:the\s+function\s+)?|differentiate\s+(?:the\s+function\s+)?)([^,?;]+)/i);
    if (funcMatch) {
      expr = funcMatch[1].trim();
    }
  }

  // Strip any lingering function identifiers or English lead words
  expr = expr.replace(/^[fy]\s*\(\s*x\s*\)\s*=?/i, "").trim();
  expr = expr.replace(/^[fy]\s*=/i, "").trim();
  expr = expr.replace(/^(?:find|calculate|solve|the|derivative|of|function|is|please|explain|me)\s+/gi, "").trim();

  // Check if expression contains polynomial variable x (must be isolated from English letters)
  if (!/(?<![a-zA-Z])x(?![a-zA-Z])/i.test(expr) && !/(?<![a-zA-Z])x\^/i.test(expr)) {
    return null;
  }

  // Tokenize polynomial terms
  // Matches isolated variable x terms and constants, ignoring English words like "explain"
  const termRegex = /(?:[+-]?\s*(?:\d+(?:\.\d+)?\s*\*?\s*)?(?<![a-zA-Z])x(?:\^\s*[+-]?\d+)?(?![a-zA-Z]))|(?:[+-]?\s*\d+(?:\.\d+)?)(?![x^a-zA-Z])/gi;
  const rawTerms: string[] = [];
  let match;

  while ((match = termRegex.exec(expr)) !== null) {
    const term = match[0].replace(/\s+/g, "");
    if (term && term !== "+" && term !== "-") {
      rawTerms.push(term);
    }
  }

  if (rawTerms.length === 0) {
    return null;
  }

  interface TermParsed {
    coeff: number;
    power: number;
    raw: string;
  }

  const parsedTerms: TermParsed[] = [];

  for (const raw of rawTerms) {
    let sign = 1;
    let s = raw;
    if (s.startsWith("-")) {
      sign = -1;
      s = s.slice(1);
    } else if (s.startsWith("+")) {
      s = s.slice(1);
    }

    if (s.toLowerCase().includes("x")) {
      const parts = s.split(/x\^?/i);
      const coeffStr = parts[0].replace(/\*/g, "");
      const coeffVal = coeffStr === "" ? 1 : parseFloat(coeffStr);
      const powerStr = parts[1];
      const powerVal = powerStr !== undefined && powerStr !== "" ? parseInt(powerStr, 10) : 1;

      parsedTerms.push({
        coeff: sign * coeffVal,
        power: powerVal,
        raw,
      });
    } else {
      // Constant
      const val = parseFloat(s);
      if (!isNaN(val)) {
        parsedTerms.push({
          coeff: sign * val,
          power: 0,
          raw,
        });
      }
    }
  }

  if (parsedTerms.length === 0) {
    return null;
  }

  // Format the pretty original function
  const formattedFunc = parsedTerms
    .map((t, idx) => {
      let termStr = "";
      const absCoeff = Math.abs(t.coeff);
      const signStr = idx === 0 ? (t.coeff < 0 ? "-" : "") : t.coeff < 0 ? " - " : " + ";

      if (t.power === 0) {
        termStr = `${absCoeff}`;
      } else if (t.power === 1) {
        termStr = absCoeff === 1 ? "x" : `${absCoeff}x`;
      } else {
        termStr = absCoeff === 1 ? `x^${t.power}` : `${absCoeff}x^${t.power}`;
      }

      return `${signStr}${termStr}`;
    })
    .join("");

  // Differentiate each term
  interface DiffStep {
    stepNum: number;
    termOriginal: string;
    ruleUsed: string;
    stepExplanation: string;
    resultCoeff: number;
    resultPower: number;
    formattedResult: string;
  }

  const steps: DiffStep[] = [];
  const resultingTerms: { coeff: number; power: number }[] = [];

  parsedTerms.forEach((t, i) => {
    const stepNum = i + 1;
    if (t.power === 0) {
      // Constant rule
      steps.push({
        stepNum,
        termOriginal: `${t.coeff < 0 ? "-" : ""}${Math.abs(t.coeff)}`,
        ruleUsed: "Constant Rule (d/dx[c] = 0)",
        stepExplanation: `Since **${t.coeff}** is a constant, its value does not change as $x$ changes. The rate of change is zero:\n$$\\frac{d}{dx}[${t.coeff}] = 0$$`,
        resultCoeff: 0,
        resultPower: 0,
        formattedResult: "0",
      });
    } else if (t.power === 1) {
      // Linear term
      const resultCoeff = t.coeff;
      steps.push({
        stepNum,
        termOriginal: `${t.coeff === 1 ? "" : t.coeff === -1 ? "-" : t.coeff}x`,
        ruleUsed: "Power Rule (d/dx[x] = 1)",
        stepExplanation: `Applying the Power Rule with $n = 1$:\n$$\\frac{d}{dx}[${t.coeff}x] = ${t.coeff} \\cdot (1x^{1-1}) = ${t.coeff} \\cdot x^0 = ${t.coeff} \\cdot 1 = \\mathbf{${resultCoeff}}$$\n*(The derivative of any linear term $kx$ is simply its constant slope $k$)*`,
        resultCoeff,
        resultPower: 0,
        formattedResult: `${resultCoeff}`,
      });
      resultingTerms.push({ coeff: resultCoeff, power: 0 });
    } else {
      // Power >= 2 or negative
      const newCoeff = t.coeff * t.power;
      const newPower = t.power - 1;
      const powerStr = newPower === 1 ? "x" : `x^${newPower}`;
      const termDisplay = newCoeff === 1 ? powerStr : newCoeff === -1 ? `-${powerStr}` : `${newCoeff}${powerStr}`;

      steps.push({
        stepNum,
        termOriginal: `${t.coeff === 1 ? "" : t.coeff === -1 ? "-" : t.coeff}x^${t.power}`,
        ruleUsed: "Power Rule (d/dx[x^n] = n · x^(n-1)) & Constant Multiple Rule",
        stepExplanation: `1. Bring down the exponent **${t.power}** and multiply it by the coefficient **${t.coeff}**:\n   $$${t.coeff} \\cdot ${t.power} = ${newCoeff}$$\n2. Subtract $1$ from the exponent: $${t.power} - 1 = ${newPower}$.\n$$\\frac{d}{dx}[${t.coeff}x^${t.power}] = ${t.coeff} \\cdot (${t.power}x^{${t.power}-1}) = \\mathbf{${termDisplay}}$$`,
        resultCoeff: newCoeff,
        resultPower: newPower,
        formattedResult: termDisplay,
      });
      resultingTerms.push({ coeff: newCoeff, power: newPower });
    }
  });

  // Combine resulting terms into final derivative expression
  const activeTerms = resultingTerms.filter((t) => t.coeff !== 0);
  let finalDerivativeStr = "0";

  if (activeTerms.length > 0) {
    finalDerivativeStr = activeTerms
      .map((t, idx) => {
        const absCoeff = Math.abs(t.coeff);
        const signStr = idx === 0 ? (t.coeff < 0 ? "-" : "") : t.coeff < 0 ? " - " : " + ";

        if (t.power === 0) {
          return `${signStr}${absCoeff}`;
        }
        if (t.power === 1) {
          return `${signStr}${absCoeff === 1 ? "x" : `${absCoeff}x`}`;
        }
        return `${signStr}${absCoeff === 1 ? `x^${t.power}` : `${absCoeff}x^${t.power}`}`;
      })
      .join("");
  }

  // Calculate sample evaluations for geometrical intuition
  // e.g. for 6x + 4, at x=0 -> slope=4, at x=1 -> slope=10
  const evalAt0 = evaluatePoly(activeTerms, 0);
  const evalAt1 = evaluatePoly(activeTerms, 1);

  // Critical point if quadratic original: e.g. 6x + 4 = 0 => x = -4/6 = -2/3
  let criticalPointText = "";
  if (activeTerms.length === 2 && activeTerms[0].power === 1 && activeTerms[1].power === 0) {
    const a = activeTerms[0].coeff;
    const b = activeTerms[1].coeff;
    const xCrit = -b / a;
    const xCritFormatted = Number.isInteger(xCrit)
      ? `${xCrit}`
      : `${-b}/${a} (${xCrit.toFixed(2)})`;
    criticalPointText = `\n* **Vertex / Turning Point**: Where is the curve's slope completely flat? Setting $f'(x) = 0$:\n  $$${finalDerivativeStr} = 0 \\implies ${a}x = ${-b} \\implies x = ${xCritFormatted}$$\n  At $x = ${xCritFormatted}$, the tangent line is horizontal. This corresponds to the vertex (minimum) of the parabola.`;
  }

  return `Hello! Let's solve this differentiation problem step-by-step together on the whiteboard so you can clearly understand how each rule is applied.

### 📝 Problem Statement
Find the derivative of the function:
$$f(x) = ${formattedFunc}$$

---

### 🔍 Step-by-Step Differentiation (Whiteboard Walkthrough)

To find the derivative $f'(x)$ (also written as $\\frac{df}{dx}$), we apply the **Sum and Difference Rule**, which allows us to differentiate each term separately:
$$\\frac{d}{dx}[f(x)] = ${steps.map((s) => `\\frac{d}{dx}[${s.termOriginal}]`).join(" + ").replace(/\+\s*\\frac\{d\}\{dx\}\[-/g, "- \\frac{d}{dx}[")}$$

${steps
  .map(
    (s) => `#### **Step ${s.stepNum}: Differentiate ${s.termOriginal}**
* **Rule**: ${s.ruleUsed}
${s.stepExplanation}`
  )
  .join("\n\n")}

---

### 🎯 Step 4: Combine the Terms & Final Answer
Now we combine the differentiated terms together:
$$f'(x) = ${finalDerivativeStr}$$

**Final Answer:**
$$\\mathbf{f'(x) = ${finalDerivativeStr}} \\quad \\text{or} \\quad \\mathbf{\\frac{df}{dx} = ${finalDerivativeStr}}$$

---

### 💡 Geometric Intuition & What This Means
* **Instantaneous Rate of Change**: The derivative $f'(x) = ${finalDerivativeStr}$ gives you the exact slope of the tangent line to the original curve $f(x) = ${formattedFunc}$ at **any** point $x$.
  * At $x = 0$: The slope is $f'(0) = \\mathbf{${evalAt0}}$ (the tangent line rises at a rate of ${evalAt0}).
  * At $x = 1$: The slope is $f'(1) = \\mathbf{${evalAt1}}$.${criticalPointText}

Source: ${materialTitle} — Page ${pageNumber}`;
}

/**
 * Solves special functions (trig, exp, ln).
 */
function trySolveSpecialDerivative(
  query: string,
  materialTitle: string,
  pageNumber: number
): string | null {
  const q = query.toLowerCase();

  if (q.includes("sin(x)") || q.includes("sin x")) {
    return `Hello! Let's differentiate $\\sin(x)$ step-by-step.

### 📝 Problem Statement
Find the derivative of:
$$f(x) = \\sin(x)$$

---

### 🔍 Step-by-Step Whiteboard Walkthrough
1. **Fundamental Derivative Rule**:
   The derivative of the sine function is the cosine function:
   $$\\frac{d}{dx}[\\sin(x)] = \\cos(x)$$

2. **Geometric Intuition**:
   * At $x = 0$, $\\sin(0) = 0$, but the curve is passing through the origin at its steepest upward angle. The slope is $\\cos(0) = 1$.
   * At $x = \\frac{\\pi}{2}$ (the crest of the wave), the curve peaks and flattens out. The slope is $\\cos\\left(\\frac{\\pi}{2}\\right) = 0$.
   * At $x = \\pi$, the wave heads downward with slope $\\cos(\\pi) = -1$.

---

### 🎯 Final Answer
$$\\mathbf{f'(x) = \\cos(x)}$$

Source: ${materialTitle} — Page ${pageNumber}`;
  }

  if (q.includes("cos(x)") || q.includes("cos x")) {
    return `Hello! Let's differentiate $\\cos(x)$ step-by-step.

### 📝 Problem Statement
Find the derivative of:
$$f(x) = \\cos(x)$$

---

### 🔍 Step-by-Step Whiteboard Walkthrough
1. **Fundamental Derivative Rule**:
   The derivative of the cosine function is the negative sine function:
   $$\\frac{d}{dx}[\\cos(x)] = -\\sin(x)$$

2. **Why the Minus Sign?**:
   * At $x = 0$, $\\cos(0) = 1$ is at its maximum peak, so the slope is horizontal: $-\\sin(0) = 0$.
   * As $x$ moves to the right of zero, the cosine curve drops downward, meaning its slope is negative: $-\\sin(x) < 0$.

---

### 🎯 Final Answer
$$\\mathbf{f'(x) = -\\sin(x)}$$

Source: ${materialTitle} — Page ${pageNumber}`;
  }

  if (q.includes("e^x") || q.includes("exp(x)")) {
    return `Hello! Let's look at the remarkable derivative of the natural exponential function $e^x$.

### 📝 Problem Statement
Find the derivative of:
$$f(x) = e^x$$

---

### 🔍 Step-by-Step Whiteboard Walkthrough
1. **The Unique Property of $e$**:
   Euler's number ($e \\approx 2.71828$) is specifically defined such that the function $e^x$ is its own derivative:
   $$\\frac{d}{dx}[e^x] = e^x$$

2. **Intuitive Meaning**:
   At any point on the graph $y = e^x$, the height of the graph is exactly equal to the slope of the graph!
   * When $y = 1$ (at $x=0$), the slope is $1$.
   * When $y = 100$, the slope is $100$.

---

### 🎯 Final Answer
$$\\mathbf{f'(x) = e^x}$$

Source: ${materialTitle} — Page ${pageNumber}`;
  }

  if (q.includes("ln(x)") || q.includes("log(x)")) {
    return `Hello! Let's find the derivative of the natural logarithm function $\\ln(x)$.

### 📝 Problem Statement
Find the derivative of:
$$f(x) = \\ln(x) \\quad (x > 0)$$

---

### 🔍 Step-by-Step Whiteboard Walkthrough
1. **Fundamental Derivative Rule**:
   $$\\frac{d}{dx}[\\ln(x)] = \\frac{1}{x}$$

2. **Intuitive Meaning**:
   * As $x$ is small (close to 0), $\\frac{1}{x}$ is huge—the logarithmic curve shoots upward almost vertically.
   * As $x$ grows large, $\\frac{1}{x}$ approaches zero—the curve flattens out, continuing to grow, but at an ever-slower rate.

---

### 🎯 Final Answer
$$\\mathbf{f'(x) = \\frac{1}{x}}$$

Source: ${materialTitle} — Page ${pageNumber}`;
  }

  return null;
}

/**
 * Conceptual explanation of differentiation for students.
 */
export function getDifferentiationConceptExplanation(
  materialTitle: string,
  pageNumber: number
): string {
  return `Welcome! Let's explore differentiation together—it is one of the most foundational and powerful concepts in all of mathematics.

💡 **Core Intuition & The Speedometer Analogy**:
Think about taking a road trip in your car:
- Your **odometer** (trip meter) records the total distance you have traveled ($s(t)$).
- If you drive 60 miles in 1 hour, your *average* speed was 60 mph ($v_{avg} = \\frac{\\Delta s}{\\Delta t}$).
- But at minute 20, you might have stopped at a red light (0 mph), and at minute 45, cruising at 75 mph on the highway.
- Your **speedometer** tells you how fast you are moving right at that exact split second.

👉 **Differentiation is the mathematical tool that gives you the instantaneous speedometer reading from your distance formula!**

---

🔍 **The Mathematical Definition (Whiteboard Walkthrough)**:
1. **Average Rate of Change (Secant Line)**:
   Between two points $x$ and $x + \\Delta x$, the average rate of change is the slope of the line connecting them:
   $$\\frac{\\Delta y}{\\Delta x} = \\frac{f(x + \\Delta x) - f(x)}{\\Delta x}$$
2. **Taking the Limit as $\\Delta x \\to 0$ (Tangent Line)**:
   As the time gap $\\Delta x$ shrinks closer and closer to zero ($\\Delta x \\to 0$), the secant line rotates until it touches the curve at a single point—becoming the **tangent line**.
3. **The Derivative Formula**:
   $$f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x + \\Delta x) - f(x)}{\\Delta x}$$
   The derivative $f'(x)$ (also written as $\\frac{df}{dx}$ or $\\frac{dy}{dx}$) represents the **exact instantaneous rate of change** or the **slope of the tangent line**.

---

📐 **Essential Differentiation Rules (Cheat Sheet)**:
* **Power Rule**: $\\frac{d}{dx}[x^n] = n x^{n-1}$ *(e.g., $\\frac{d}{dx}[x^3] = 3x^2$)*
* **Constant Rule**: $\\frac{d}{dx}[c] = 0$ *(constants never change)*
* **Constant Multiple**: $\\frac{d}{dx}[c \\cdot f(x)] = c \\cdot f'(x)$
* **Sum & Difference**: $\\frac{d}{dx}[f(x) \\pm g(x)] = f'(x) \\pm g'(x)$
* **Product Rule**: $\\frac{d}{dx}[u \\cdot v] = u v' + v u'$
* **Quotient Rule**: $\\frac{d}{dx}\\left[\\frac{u}{v}\\right] = \\frac{v u' - u v'}{v^2}$
* **Chain Rule**: $\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)$

---

🚀 **Why Differentiation Matters**:
* **Physics**: From position $x(t)$, the first derivative is velocity $v(t) = x'(t)$, and the second derivative is acceleration $a(t) = x''(t)$.
* **Optimization & Economics**: Finding maximum profit, minimum cost, or optimal efficiency by setting $f'(x) = 0$.
* **AI & Deep Learning**: Neural networks learn via **Gradient Descent** (multivariable differentiation / backpropagation) to minimize prediction error!

🎯 **Key Takeaway**:
Whenever you see a derivative $\\frac{df}{dx}$ or $f'(x)$, think: *"How fast is $f$ changing right at this exact split-second when $x$ nudges forward?"*

Source: ${materialTitle} — Page ${pageNumber}`;
}

/**
 * Conceptual explanation of integration.
 */
function getIntegrationConceptExplanation(
  materialTitle: string,
  pageNumber: number
): string {
  return `Welcome! Let's explore Integral Calculus—the magnificent counterpart to differentiation.

💡 **Core Intuition & The Big Picture**:
If differentiation tells you your car's instantaneous speed from your odometer, **integration is the reverse process**:
If you recorded your car's speedometer reading at every single instant, how would you calculate the total distance traveled?
You multiply each tiny interval of time by your speed at that instant, and add up all those thousands of tiny slices!

🔍 **Step-by-Step Breakdown**:
1. **Slicing into Strips (Riemann Sums)**: We divide an area or time duration into tiny strips of width $\\Delta x$. Each strip has an approximate area of $f(x) \\cdot \\Delta x$.
2. **Continuous Addition**: As we shrink $\\Delta x \\to 0$, the sum of rectangles becomes the continuous integral: $\\int f(x) \\, dx$.
3. **The Fundamental Theorem of Calculus**: Differentiation and integration are inverse operations. Taking the derivative of an accumulated integral brings you right back to your original rate function!

🎯 **Key Takeaway**:
Integration is continuous accumulation. It adds up momentary rates of change to recover total net change (like calculating total distance from speed, or finding the total area under a curve).

Source: ${materialTitle} — Page ${pageNumber}`;
}

/**
 * Conceptual explanation of limits.
 */
function getLimitsConceptExplanation(
  materialTitle: string,
  pageNumber: number
): string {
  return `Welcome! Let's explore Limits—the foundation upon which all of calculus is built.

💡 **Core Intuition**:
Imagine walking toward a doorway. With each step, you cut your remaining distance in half. You never quite "touch" the doorframe in finite steps, but you can get as close as humanly conceivable (within a millimeter, a nanometer, etc.).
A **limit** asks: *"What value is this function heading toward as $x$ approaches a target number $c$?"* It does not care what happens *at* $c$, only what happens as you get infinitely close to $c$!

🔍 **Mathematical Definition**:
$$\\lim_{x \\to c} f(x) = L$$
This means that as $x$ gets arbitrarily close to $c$ from both the left and right sides, $f(x)$ approaches $L$.

🎯 **Key Takeaway**:
Limits allow mathematicians to legally handle division by zero and study rates of change over zero-length time intervals!

Source: ${materialTitle} — Page ${pageNumber}`;
}

/**
 * Conceptual explanation of chain rule.
 */
function getChainRuleConceptExplanation(
  materialTitle: string,
  pageNumber: number
): string {
  return `Welcome! Let's explore the Chain Rule—the master key for differentiating composite functions.

💡 **Core Intuition & The Bicycle Gears Analogy**:
Imagine riding a bicycle with two interconnected gears:
- Gear A turns Gear B twice as fast: $\\frac{dB}{dA} = 2$.
- Gear B turns Gear C three times as fast: $\\frac{dC}{dB} = 3$.
How fast does Gear C turn relative to Gear A?
$$\\frac{dC}{dA} = \\frac{dC}{dB} \\cdot \\frac{dB}{dA} = 3 \\cdot 2 = 6$$
You simply **multiply the rates of change together**!

🔍 **The Chain Rule Formula**:
For a nested function $y = f(g(x))$:
$$\\frac{dy}{dx} = f'(g(x)) \\cdot g'(x)$$
*(Differentiate the outer function, keeping the inside unchanged, then multiply by the derivative of the inside function)*.

🎯 **Key Takeaway**:
When functions are layered inside one another, their rates of change multiply: $\\text{Outer}'(\\text{Inner}) \\cdot \\text{Inner}'$.

Source: ${materialTitle} — Page ${pageNumber}`;
}

/**
 * Conceptual explanation of Product & Quotient rules.
 */
function getProductQuotientRuleExplanation(
  materialTitle: string,
  pageNumber: number
): string {
  return `Welcome! Let's unpack the Product and Quotient Rules.

💡 **Why Isn't the Derivative of $u \\cdot v$ Just $u' \\cdot v'$?**:
Think of a rectangle with width $u$ and height $v$. Its area is $A = u \\cdot v$.
If both width and height expand simultaneously:
- The width grows by $\\Delta u$, adding a strip of area $v \\cdot \\Delta u$.
- The height grows by $\\Delta v$, adding a strip of area $u \\cdot \\Delta v$.
Both dimensions contribute to the growing area!

🔍 **Formulas**:
* **Product Rule**:
  $$\\frac{d}{dx}[u \\cdot v] = u \\frac{dv}{dx} + v \\frac{du}{dx}$$
* **Quotient Rule**:
  $$\\frac{d}{dx}\\left[\\frac{u}{v}\\right] = \\frac{v \\frac{du}{dx} - u \\frac{dv}{dx}}{v^2} \\quad \\text{(\"Low d-High minus High d-Low, over the square of what's below\")}$$

🎯 **Key Takeaway**:
Whenever quantities multiply or divide, their rate of growth involves cross-terms reflecting how each component influences the other.

Source: ${materialTitle} — Page ${pageNumber}`;
}

function evaluatePoly(terms: { coeff: number; power: number }[], x: number): number {
  return terms.reduce((sum, t) => sum + t.coeff * Math.pow(x, t.power), 0);
}
