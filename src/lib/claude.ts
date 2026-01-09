import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Category {
  id: string;
  name: string;
  description: string;
}

interface EmailForCategorization {
  subject: string;
  from: string;
  snippet: string;
  bodyText: string;
}


export async function categorizeAndSummarizeEmail(
  email: EmailForCategorization,
  categories: Category[]
): Promise<{ categoryId: string | null; summary: string }> {
  const categoryList = categories
    .map((c) => `- "${c.name}" (ID: ${c.id}): ${c.description}`)
    .join("\n");

  const prompt = `You are an email assistant. Analyze this email and:
1. Categorize it into one of the available categories
2. Provide a brief 1-2 sentence summary

Available categories:
${categoryList}

Email details:
- Subject: ${email.subject}
- From: ${email.from}
- Preview: ${email.snippet}
- Content: ${email.bodyText.substring(0, 2000)}

Respond in this exact JSON format:
{
  "categoryId": "the-category-id-or-null",
  "summary": "Your 1-2 sentence summary here"
}

If no category fits, use null for categoryId.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      // Try to extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Verify category ID is valid
        let categoryId = parsed.categoryId;
        if (categoryId && !categories.find((c) => c.id === categoryId)) {
          categoryId = null;
        }
        return {
          categoryId,
          summary: parsed.summary || "Unable to generate summary.",
        };
      }
    }
    return { categoryId: null, summary: "Unable to generate summary." };
  } catch (error) {
    console.error("Error processing email with AI:", error);
    return { categoryId: null, summary: "Unable to generate summary." };
  }
}
