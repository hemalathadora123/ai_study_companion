import { describe, it, expect } from "vitest";
import { isMathProblemQuery, solveOrExplainMath } from "@/lib/ai/mathSolver";
import { generateAiResponse } from "@/lib/ai/provider";

describe("Math Problem Solver & Pedagogical Concept Differentiation", () => {
  it("detects problem-solving requests vs conceptual inquiries correctly", () => {
    expect(isMathProblemQuery("Find the derivative of the function f(x) = 3x2 + 4x - 2")).toBe(true);
    expect(isMathProblemQuery("Calculate the derivative of 5x^3 - 2x + 1")).toBe(true);
    expect(isMathProblemQuery("Differentiate f(x) = x^2 - 4")).toBe(true);
    expect(isMathProblemQuery("Find the derivative of sin(x)")).toBe(true);

    expect(isMathProblemQuery("explain me the differentiation")).toBe(false);
    expect(isMathProblemQuery("what is differentiation")).toBe(false);
    expect(isMathProblemQuery("explain differentiation like a teacher")).toBe(false);
  });

  it("solves polynomial derivative f(x) = 3x2 + 4x - 2 step-by-step with complete whiteboard calculations", () => {
    const result = solveOrExplainMath(
      "Find the derivative of the function f(x) = 3x2 + 4x - 2",
      "Calculus (Gilbert Strang)",
      18
    );

    expect(result.isHandled).toBe(true);
    expect(result.text).toContain("f(x) = 3x^2 + 4x - 2");
    expect(result.text).toContain("Power Rule");
    expect(result.text).toContain("Constant Rule");
    expect(result.text).toContain("6x");
    expect(result.text).toContain("4");
    expect(result.text).toContain("f'(x) = 6x + 4");
    expect(result.text).toContain("Final Answer");
    expect(result.text).toContain("Geometric Intuition");
  });

  it("provides rich conceptual lesson for 'explain me the differentiation' with analogies and definition", () => {
    const result = solveOrExplainMath(
      "explain me the differentiation",
      "Calculus (Gilbert Strang)",
      18
    );

    expect(result.isHandled).toBe(true);
    expect(result.text).toContain("Speedometer Analogy");
    expect(result.text).toContain("Average Rate of Change");
    expect(result.text).toContain("Tangent Line");
    expect(result.text).toContain("lim");
    expect(result.text).toContain("Power Rule");
    expect(result.text).toContain("Why Differentiation Matters");
  });

  it("guarantees the responses for problem solving and concept explanation are completely distinct", () => {
    const rProblem = solveOrExplainMath(
      "Find the derivative of the function f(x) = 3x2 + 4x - 2",
      "Calculus (Gilbert Strang)",
      18
    );
    const rConcept = solveOrExplainMath(
      "explain me the differentiation",
      "Calculus (Gilbert Strang)",
      18
    );

    expect(rProblem.text).not.toEqual(rConcept.text);
    expect(rProblem.text).toContain("6x + 4");
    expect(rConcept.text).not.toContain("6x + 4");
  });

  it("executes through generateAiResponse with feature: TUTOR seamlessly", async () => {
    const aiResult = await generateAiResponse({
      prompt: "STUDENT'S QUESTION: Find the derivative of the function f(x) = 3x2 + 4x - 2\nPROJECT EVIDENCE CHUNKS:\n[Source: \"Calculus\" — Page 18]:\n\"Differentiation rules and polynomials.\"",
      feature: "TUTOR",
      metadata: {
        userQuestion: "Find the derivative of the function f(x) = 3x2 + 4x - 2",
        evidence: [
          { materialTitle: "Calculus (Gilbert Strang)", pageNumber: 18, content: "Differentiation rules and polynomials." },
        ],
      },
    });

    expect(aiResult.text).toContain("6x + 4");
    expect(aiResult.text).toContain("Power Rule");
  });
});
