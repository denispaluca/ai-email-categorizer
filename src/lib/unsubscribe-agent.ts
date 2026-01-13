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
  userEmail: string,
): Promise<UnsubscribeResult> {
  const steps: string[] = [];
  let browser: Browser | null = null;

  console.log(`[UnsubscribeAgent] Starting unsubscribe process for URL: ${url}, userEmail: ${userEmail}`);

  try {
    steps.push(`Starting unsubscribe process for: ${url}`);

    console.log("[UnsubscribeAgent] Launching headless browser...");
    browser = await chromium.launch({
      headless: true,
    });
    console.log("[UnsubscribeAgent] Browser launched successfully");

    console.log("[UnsubscribeAgent] Creating browser context...");
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    console.log("[UnsubscribeAgent] Browser context created");

    console.log("[UnsubscribeAgent] Creating new page...");
    const page = await context.newPage();
    console.log("[UnsubscribeAgent] New page created");

    // Navigate to the unsubscribe URL
    steps.push("Navigating to unsubscribe page...");
    console.log(`[UnsubscribeAgent] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    console.log("[UnsubscribeAgent] Page loaded, waiting 2s for content to settle...");
    await sleep(2000);
    steps.push(`Page loaded: ${page.url()}`);
    console.log(`[UnsubscribeAgent] Final URL after navigation: ${page.url()}`);

    // Run the agent loop
    console.log(`[UnsubscribeAgent] Starting agent loop (max ${MAX_ITERATIONS} iterations)`);
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      console.log(`[UnsubscribeAgent] === Iteration ${iteration + 1}/${MAX_ITERATIONS} ===`);
      steps.push(`\n--- Iteration ${iteration + 1} ---`);

      // Get simplified page HTML for text-based analysis
      console.log("[UnsubscribeAgent] Extracting simplified DOM from page...");
      const pageContent = await page.evaluate(() => {
        // Tags to completely skip - they contain no useful information for the AI
        const skipTags = new Set([
          "script",
          "style",
          "noscript",
          "svg",
          "path",
          "meta",
          "link",
          "head",
          "iframe",
          "canvas",
          "video",
          "audio",
          "source",
          "track",
          "template",
          "slot",
          "picture",
          "map",
          "area",
        ]);

        // Tags that are containers but don't need to show their own info
        const containerOnlyTags = new Set([
          "html",
          "body",
          "main",
          "article",
          "section",
          "header",
          "footer",
          "nav",
          "aside",
          "div",
          "span",
          "ul",
          "ol",
          "li",
          "table",
          "tbody",
          "thead",
          "tr",
          "td",
          "th",
          "dl",
          "dt",
          "dd",
          "figure",
          "figcaption",
        ]);

        const getSimplifiedDOM = (element: Element, depth = 0): string => {
          const tag = element.tagName.toLowerCase();

          // Skip elements that provide no useful info
          if (skipTags.has(tag)) return "";

          // Skip hidden elements
          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden")
            return "";

          // Get attributes that matter for interaction
          const id = element.id ? `#${element.id}` : "";
          const classes =
            element.className && typeof element.className === "string"
              ? `.${element.className.trim().split(/\s+/).join(".")}`
              : "";
          const type = element.getAttribute("type")
            ? `[type="${element.getAttribute("type")}"]`
            : "";
          const name = element.getAttribute("name")
            ? `[name="${element.getAttribute("name")}"]`
            : "";
          const href = element.getAttribute("href")
            ? `[href="${element.getAttribute("href")}"]`
            : "";
          // Get current value from DOM property for form elements
          let value = "";
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement
          ) {
            const currentValue = element.value;
            if (currentValue) {
              value = `[value="${currentValue}"]`;
            }
          } else {
            // Fallback to attribute for other elements
            const attrValue = element.getAttribute("value");
            if (attrValue) {
              value = `[value="${attrValue}"]`;
            }
          }
          const placeholder = element.getAttribute("placeholder")
            ? `[placeholder="${element.getAttribute("placeholder")}"]`
            : "";
          const role = element.getAttribute("role")
            ? `[role="${element.getAttribute("role")}"]`
            : "";
          const ariaLabel = element.getAttribute("aria-label")
            ? `[aria-label="${element.getAttribute("aria-label")}"]`
            : "";

          // Get direct text content (not from children)
          let directText = "";
          for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent?.trim();
              if (text) directText += text + " ";
            }
          }
          directText = directText.trim().substring(0, 100);

          // Build the result
          let result = "";
          const indent = "  ".repeat(depth);
          const attrs = `${id}${classes}${type}${name}${href}${value}${placeholder}${role}${ariaLabel}`;

          // For container-only tags, only show if they have meaningful attributes
          if (containerOnlyTags.has(tag)) {
            if (attrs || directText) {
              result = `${indent}<${tag}${attrs}>${directText ? ` "${directText}"` : ""}\n`;
            }
          } else {
            // For interactive/content elements, always show
            result = `${indent}<${tag}${attrs}>${directText ? ` "${directText}"` : ""}\n`;
          }

          // Process children
          for (const child of element.children) {
            result += getSimplifiedDOM(child, depth + 1);
          }

          return result;
        };

        return getSimplifiedDOM(document.body);
      });
      console.log(`[UnsubscribeAgent] DOM extracted (${pageContent.length} chars)`);

      // First try HTML-based analysis (faster and cheaper)
      console.log("[UnsubscribeAgent] Sending DOM to Claude for HTML-based analysis...");
      let action = await analyzePageWithHtml(pageContent, page.url(), steps, userEmail);
      console.log(`[UnsubscribeAgent] HTML analysis result: type=${action.type}, description="${action.description}"`);

      // If HTML-based analysis returns an error, fall back to screenshot-based
      if (action.type === "error") {
        steps.push("HTML analysis inconclusive, using screenshot analysis...");
        console.log("[UnsubscribeAgent] HTML analysis inconclusive, falling back to screenshot analysis...");

        // Take a screenshot for vision-based fallback
        console.log("[UnsubscribeAgent] Taking screenshot...");
        const screenshot = await page.screenshot({ type: "png" });
        const screenshotBase64 = screenshot.toString("base64");
        console.log(`[UnsubscribeAgent] Screenshot taken (${screenshotBase64.length} chars base64)`);

        console.log("[UnsubscribeAgent] Sending screenshot to Claude for vision-based analysis...");
        action = await analyzePageWithScreenshot(
          screenshotBase64,
          pageContent,
          page.url(),
          steps,
          userEmail,
        );
        console.log(`[UnsubscribeAgent] Screenshot analysis result: type=${action.type}, description="${action.description}"`);
      }

      steps.push(`AI decided: ${action.description}`);
      console.log(`[UnsubscribeAgent] AI decision: ${action.type} - ${action.description}`);

      if (action.type === "done") {
        console.log("[UnsubscribeAgent] SUCCESS: Unsubscribe process completed!");
        steps.push("Unsubscribe process completed successfully!");
        console.log("[UnsubscribeAgent] Closing browser...");
        await browser.close();
        console.log("[UnsubscribeAgent] Browser closed");
        return {
          url,
          success: true,
          message: action.description,
          steps,
        };
      }

      if (action.type === "error") {
        console.log(`[UnsubscribeAgent] ERROR: ${action.description}`);
        steps.push(`Error: ${action.description}`);
        console.log("[UnsubscribeAgent] Closing browser...");
        await browser.close();
        console.log("[UnsubscribeAgent] Browser closed");
        return {
          url,
          success: false,
          message: action.description,
          steps,
        };
      }

      // Execute the action
      console.log(`[UnsubscribeAgent] Executing action: ${action.type}${action.selector ? ` on "${action.selector}"` : ""}${action.value ? ` with value "${action.value}"` : ""}`);
      try {
        await executeAction(page, action, steps);
        console.log("[UnsubscribeAgent] Action executed successfully");
        // Wait for any navigation or updates
        console.log("[UnsubscribeAgent] Waiting 1.5s for page updates...");
        await page.waitForTimeout(1500);
      } catch (actionError) {
        const errorMsg = actionError instanceof Error ? actionError.message : "Unknown error";
        console.log(`[UnsubscribeAgent] Action execution FAILED: ${errorMsg}`);
        steps.push(
          `Failed to execute action: ${errorMsg}`,
        );
        // Continue to next iteration to try again
        console.log("[UnsubscribeAgent] Will retry in next iteration...");
      }
    }

    console.log("[UnsubscribeAgent] Max iterations reached without completing unsubscribe");
    steps.push("Max iterations reached without completing unsubscribe");
    console.log("[UnsubscribeAgent] Closing browser...");
    await browser.close();
    console.log("[UnsubscribeAgent] Browser closed");
    return {
      url,
      success: false,
      message: "Max iterations reached without completing unsubscribe process",
      steps,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(`[UnsubscribeAgent] EXCEPTION: ${errorMessage}`);
    steps.push(`Error: ${errorMessage}`);

    if (browser) {
      console.log("[UnsubscribeAgent] Closing browser after exception...");
      await browser.close();
      console.log("[UnsubscribeAgent] Browser closed");
    }

    return {
      url,
      success: false,
      message: errorMessage,
      steps,
    };
  }
}

const getBasePromptInstructions = (userEmail: string) => `You are an AI agent helping a user unsubscribe from email newsletters. Your goal is to complete the unsubscribe process.

The user's email address is: ${userEmail}

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
- If you see an email input field, type the user's email address: ${userEmail}
- If there are multiple unsubscribe options, prefer "unsubscribe from all"
- Click confirmation checkboxes before submit buttons`;

async function analyzePageWithHtml(
  simplifiedDom: string,
  currentUrl: string,
  previousSteps: string[],
  userEmail: string,
): Promise<AgentAction> {
  console.log("[UnsubscribeAgent:analyzeHtml] Building prompt for Claude...");
  const prompt = `${getBasePromptInstructions(userEmail)}

Current URL: ${currentUrl}

Previous steps taken:
${previousSteps.slice(-10).join("\n")}

Simplified page DOM (showing visible interactive elements with their attributes):
${simplifiedDom}

Analyze the DOM structure and decide the SINGLE next action to take. The DOM shows:
- Element tags with id (#), classes (.), and key attributes like [type], [name], [href], [role], [aria-label]
- Direct text content in quotes
- Hidden elements and scripts/styles have been removed`;

  console.log(`[UnsubscribeAgent:analyzeHtml] Prompt length: ${prompt.length} chars`);

  try {
    console.log("[UnsubscribeAgent:analyzeHtml] Calling Claude API (claude-4-sonnet-20250514)...");
    const response = await anthropic.messages.create({
      model: "claude-4-sonnet-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    console.log(`[UnsubscribeAgent:analyzeHtml] Claude API response received (${response.usage?.output_tokens || 0} tokens)`);

    const content = response.content[0];
    if (content.type === "text") {
      console.log(`[UnsubscribeAgent:analyzeHtml] Raw response: ${content.text}`);
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AgentAction;
        console.log(`[UnsubscribeAgent:analyzeHtml] Parsed action: ${JSON.stringify(parsed)}`);
        return parsed;
      }
    }

    console.log("[UnsubscribeAgent:analyzeHtml] Failed to parse AI response - no valid JSON found");
    return {
      type: "error",
      description: "Failed to parse AI response",
    };
  } catch (error) {
    console.error("[UnsubscribeAgent:analyzeHtml] Error analyzing page with HTML:", error);
    return {
      type: "error",
      description: `AI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function analyzePageWithScreenshot(
  screenshotBase64: string,
  simplifiedDom: string,
  currentUrl: string,
  previousSteps: string[],
  userEmail: string,
): Promise<AgentAction> {
  console.log("[UnsubscribeAgent:analyzeScreenshot] Building prompt for Claude with screenshot...");
  const prompt = `${getBasePromptInstructions(userEmail)}

Current URL: ${currentUrl}

Previous steps taken:
${previousSteps.slice(-10).join("\n")}

Simplified page DOM (for selector reference):
${simplifiedDom.substring(0, 5000)}

Analyze the screenshot and decide the SINGLE next action to take. Use the DOM structure above to help construct accurate CSS selectors.`;

  console.log(`[UnsubscribeAgent:analyzeScreenshot] Prompt length: ${prompt.length} chars, Screenshot size: ${screenshotBase64.length} chars`);

  try {
    console.log("[UnsubscribeAgent:analyzeScreenshot] Calling Claude API (claude-sonnet-4-20250514) with vision...");
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
    console.log(`[UnsubscribeAgent:analyzeScreenshot] Claude API response received (${response.usage?.output_tokens || 0} tokens)`);

    const content = response.content[0];
    if (content.type === "text") {
      console.log(`[UnsubscribeAgent:analyzeScreenshot] Raw response: ${content.text}`);
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AgentAction;
        console.log(`[UnsubscribeAgent:analyzeScreenshot] Parsed action: ${JSON.stringify(parsed)}`);
        return parsed;
      }
    }

    console.log("[UnsubscribeAgent:analyzeScreenshot] Failed to parse AI response - no valid JSON found");
    return {
      type: "error",
      description: "Failed to parse AI response",
    };
  } catch (error) {
    console.error("[UnsubscribeAgent:analyzeScreenshot] Error analyzing page with screenshot:", error);
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
  console.log(`[UnsubscribeAgent:executeAction] Executing ${action.type} action...`);
  switch (action.type) {
    case "click":
      if (!action.selector) {
        console.log("[UnsubscribeAgent:executeAction] ERROR: Click action missing selector");
        throw new Error("Click action requires a selector");
      }
      steps.push(`Clicking: ${action.selector}`);
      console.log(`[UnsubscribeAgent:executeAction] Attempting to click: ${action.selector}`);
      // Try multiple selector strategies
      try {
        // First try as-is
        console.log("[UnsubscribeAgent:executeAction] Strategy 1: Direct selector...");
        await page.click(action.selector, { timeout: 5000 });
        console.log("[UnsubscribeAgent:executeAction] Strategy 1 succeeded");
      } catch {
        console.log("[UnsubscribeAgent:executeAction] Strategy 1 failed, trying text selector...");
        // Try as text selector
        try {
          console.log("[UnsubscribeAgent:executeAction] Strategy 2: Text selector...");
          await page.getByText(action.selector.replace(/^text=/, "")).click({
            timeout: 5000,
          });
          console.log("[UnsubscribeAgent:executeAction] Strategy 2 succeeded");
        } catch {
          console.log("[UnsubscribeAgent:executeAction] Strategy 2 failed, trying role selector...");
          // Try as role
          try {
            console.log("[UnsubscribeAgent:executeAction] Strategy 3: Role selector...");
            await page
              .getByRole("button", {
                name: action.selector.replace(
                  /button:has-text\("(.*)"\)/,
                  "$1",
                ),
              })
              .click({ timeout: 5000 });
            console.log("[UnsubscribeAgent:executeAction] Strategy 3 succeeded");
          } catch {
            console.log("[UnsubscribeAgent:executeAction] Strategy 3 failed, trying partial text locator...");
            // Last resort: try finding by partial text
            console.log("[UnsubscribeAgent:executeAction] Strategy 4: Partial text locator...");
            await page
              .locator(`text=${action.selector}`)
              .first()
              .click({ timeout: 5000 });
            console.log("[UnsubscribeAgent:executeAction] Strategy 4 succeeded");
          }
        }
      }
      break;

    case "type":
      if (!action.selector || !action.value) {
        console.log("[UnsubscribeAgent:executeAction] ERROR: Type action missing selector or value");
        throw new Error("Type action requires selector and value");
      }
      steps.push(`Typing "${action.value}" into: ${action.selector}`);
      console.log(`[UnsubscribeAgent:executeAction] Typing "${action.value}" into: ${action.selector}`);
      await page.fill(action.selector, action.value, { timeout: 5000 });
      console.log("[UnsubscribeAgent:executeAction] Type action completed");
      break;

    case "select":
      if (!action.selector || !action.value) {
        console.log("[UnsubscribeAgent:executeAction] ERROR: Select action missing selector or value");
        throw new Error("Select action requires selector and value");
      }
      steps.push(`Selecting "${action.value}" in: ${action.selector}`);
      console.log(`[UnsubscribeAgent:executeAction] Selecting "${action.value}" in: ${action.selector}`);
      await page.selectOption(action.selector, action.value, { timeout: 5000 });
      console.log("[UnsubscribeAgent:executeAction] Select action completed");
      break;

    case "submit":
      steps.push("Submitting form");
      console.log("[UnsubscribeAgent:executeAction] Submitting form...");
      if (action.selector) {
        console.log(`[UnsubscribeAgent:executeAction] Using provided selector: ${action.selector}`);
        await page.click(action.selector, { timeout: 5000 });
      } else {
        // Try to find and click a submit button
        console.log("[UnsubscribeAgent:executeAction] No selector provided, searching for submit button...");
        const submitButton = page.locator(
          'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Confirm")',
        );
        await submitButton.first().click({ timeout: 5000 });
      }
      console.log("[UnsubscribeAgent:executeAction] Submit action completed");
      break;

    default:
      console.log(`[UnsubscribeAgent:executeAction] ERROR: Unknown action type: ${action.type}`);
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

export async function processUnsubscribeLinks(
  links: string[],
  userEmail: string,
): Promise<UnsubscribeResult[]> {
  console.log(`[UnsubscribeAgent:processLinks] Starting to process ${links.length} unsubscribe link(s) for user: ${userEmail}`);
  const overallStart = performance.now();

  const results: UnsubscribeResult[] = await Promise.all(
    links.map(async (link, index) => {
      const linkStart = performance.now();
      console.log(`[UnsubscribeAgent:processLinks] [${index + 1}/${links.length}] Processing: ${link}`);
      const result = await runUnsubscribeAgent(link, userEmail);
      const duration = (performance.now() - linkStart).toFixed(2);
      console.log(
        `[UnsubscribeAgent:processLinks] [${index + 1}/${links.length}] Completed in ${duration}ms - ${result.success ? "SUCCESS" : "FAILED"}: ${result.message}`,
      );
      return result;
    }),
  );

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  const totalDuration = (performance.now() - overallStart).toFixed(2);
  console.log(`[UnsubscribeAgent:processLinks] All links processed in ${totalDuration}ms - Success: ${successCount}, Failed: ${failCount}`);

  return results;
}
