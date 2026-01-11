import { chromium, Browser, Page } from "playwright";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface UnsubscribeResult {
  url: string;
  success: boolean;
  message: string;
  steps: string[];
}

interface AgentAction {
  type: "click" | "type" | "select" | "submit" | "done" | "error";
  selector?: string;
  value?: string;
  description: string;
}

const MAX_ITERATIONS = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runUnsubscribeAgent(
  url: string,
): Promise<UnsubscribeResult> {
  const steps: string[] = [];
  let browser: Browser | null = null;

  try {
    steps.push(`Starting unsubscribe process for: ${url}`);

    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // Navigate to the unsubscribe URL
    steps.push("Navigating to unsubscribe page...");
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await sleep(2000);
    steps.push(`Page loaded: ${page.url()}`);

    // Run the agent loop
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      steps.push(`\n--- Iteration ${iteration + 1} ---`);

      // Take a screenshot
      const screenshot = await page.screenshot({ type: "png" });
      const screenshotBase64 = screenshot.toString("base64");

      // Get page HTML for context
      const pageContent = await page.evaluate(() => {
        // Get simplified DOM structure
        const getSimplifiedDOM = (element: Element, depth = 0): string => {
          if (depth > 3) return "";
          const tag = element.tagName.toLowerCase();
          const id = element.id ? `#${element.id}` : "";
          const classes = element.className
            ? `.${element.className.toString().split(" ").join(".")}`
            : "";
          const type = element.getAttribute("type")
            ? `[type="${element.getAttribute("type")}"]`
            : "";
          const name = element.getAttribute("name")
            ? `[name="${element.getAttribute("name")}"]`
            : "";
          const text = element.textContent?.trim().substring(0, 50) || "";

          let result = `${"  ".repeat(depth)}<${tag}${id}${classes}${type}${name}>${text ? ` "${text}"` : ""}\n`;

          for (const child of element.children) {
            result += getSimplifiedDOM(child, depth + 1);
          }

          return result;
        };

        return getSimplifiedDOM(document.body);
      });

      // Ask Claude what to do
      const action = await analyzePageAndDecideAction(
        screenshotBase64,
        pageContent,
        page.url(),
        steps,
      );

      steps.push(`AI decided: ${action.description}`);

      if (action.type === "done") {
        steps.push("Unsubscribe process completed successfully!");
        await browser.close();
        return {
          url,
          success: true,
          message: action.description,
          steps,
        };
      }

      if (action.type === "error") {
        steps.push(`Error: ${action.description}`);
        await browser.close();
        return {
          url,
          success: false,
          message: action.description,
          steps,
        };
      }

      // Execute the action
      try {
        await executeAction(page, action, steps);
        // Wait for any navigation or updates
        await page.waitForTimeout(1500);
      } catch (actionError) {
        steps.push(
          `Failed to execute action: ${actionError instanceof Error ? actionError.message : "Unknown error"}`,
        );
        // Continue to next iteration to try again
      }
    }

    steps.push("Max iterations reached without completing unsubscribe");
    await browser.close();
    return {
      url,
      success: false,
      message: "Max iterations reached without completing unsubscribe process",
      steps,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    steps.push(`Error: ${errorMessage}`);

    if (browser) {
      await browser.close();
    }

    return {
      url,
      success: false,
      message: errorMessage,
      steps,
    };
  }
}

async function analyzePageAndDecideAction(
  screenshotBase64: string,
  pageContent: string,
  currentUrl: string,
  previousSteps: string[],
): Promise<AgentAction> {
  const prompt = `You are an AI agent helping a user unsubscribe from email newsletters. You are looking at a webpage screenshot and need to decide what action to take next.

Current URL: ${currentUrl}

Previous steps taken:
${previousSteps.slice(-10).join("\n")}

Page structure (simplified):
${pageContent.substring(0, 3000)}

Analyze the screenshot and decide the SINGLE next action to take. Your goal is to complete the unsubscribe process.

Look for:
1. Unsubscribe buttons or links
2. Confirmation checkboxes
3. "Unsubscribe from all" options
4. Email input fields (if asking for email confirmation)
5. Submit/Confirm buttons
6. Success messages indicating unsubscribe is complete

Respond with ONLY a JSON object in this exact format:
{
  "type": "click" | "type" | "select" | "submit" | "done" | "error",
  "selector": "CSS selector for the element (for click/type/select actions)",
  "value": "text to type or option to select (for type/select actions)",
  "description": "Brief description of what this action does"
}

Rules:
- Use "done" when you see a success message confirming unsubscription
- Use "error" if the page shows an error, is a dead link, or you can't proceed
- For selectors, prefer: button text > id > specific class > tag
- Use button:has-text("...") or text="..." selectors for buttons with specific text
- If you see an email input and the unsubscribe requires email, type a placeholder email
- If there are multiple unsubscribe options, prefer "unsubscribe from all"
- Click confirmation checkboxes before submit buttons`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshotBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as AgentAction;
      }
    }

    return {
      type: "error",
      description: "Failed to parse AI response",
    };
  } catch (error) {
    console.error("Error analyzing page:", error);
    return {
      type: "error",
      description: `AI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function executeAction(
  page: Page,
  action: AgentAction,
  steps: string[],
): Promise<void> {
  switch (action.type) {
    case "click":
      if (!action.selector) {
        throw new Error("Click action requires a selector");
      }
      steps.push(`Clicking: ${action.selector}`);
      // Try multiple selector strategies
      try {
        // First try as-is
        await page.click(action.selector, { timeout: 5000 });
      } catch {
        // Try as text selector
        try {
          await page.getByText(action.selector.replace(/^text=/, "")).click({
            timeout: 5000,
          });
        } catch {
          // Try as role
          try {
            await page
              .getByRole("button", {
                name: action.selector.replace(
                  /button:has-text\("(.*)"\)/,
                  "$1",
                ),
              })
              .click({ timeout: 5000 });
          } catch {
            // Last resort: try finding by partial text
            await page
              .locator(`text=${action.selector}`)
              .first()
              .click({ timeout: 5000 });
          }
        }
      }
      break;

    case "type":
      if (!action.selector || !action.value) {
        throw new Error("Type action requires selector and value");
      }
      steps.push(`Typing "${action.value}" into: ${action.selector}`);
      await page.fill(action.selector, action.value, { timeout: 5000 });
      break;

    case "select":
      if (!action.selector || !action.value) {
        throw new Error("Select action requires selector and value");
      }
      steps.push(`Selecting "${action.value}" in: ${action.selector}`);
      await page.selectOption(action.selector, action.value, { timeout: 5000 });
      break;

    case "submit":
      steps.push("Submitting form");
      if (action.selector) {
        await page.click(action.selector, { timeout: 5000 });
      } else {
        // Try to find and click a submit button
        const submitButton = page.locator(
          'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Confirm")',
        );
        await submitButton.first().click({ timeout: 5000 });
      }
      break;

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

export async function processUnsubscribeLinks(
  links: string[],
): Promise<UnsubscribeResult[]> {
  const results: UnsubscribeResult[] = await Promise.all(
    links.map(async (link) => {
      console.log(`Processing unsubscribe link: ${link}`);
      const result = await runUnsubscribeAgent(link);
      console.log(`Result for ${link}:`, result.success ? "Success" : "Failed");
      return result;
    }),
  );

  return results;
}
