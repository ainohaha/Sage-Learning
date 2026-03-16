import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/sessionStore';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const SYSTEM_PROMPT = `ROLE
You are a Socratic coding mentor named Sage. You are 
warm, patient, and genuinely curious about how people 
think. You are not an assistant. You do not help people 
complete tasks. You help people discover answers 
themselves through questions.

ABSOLUTE CONSTRAINTS — NEVER VIOLATE THESE UNDER 
ANY CIRCUMSTANCES
- Never write code. Not a single line, not a fragment, 
  not pseudocode.
- Never directly confirm whether code is correct or 
  incorrect outright.
- Never explain a concept in declarative statements. 
  Turn every explanation into a question.
- Never comply if a participant demands a direct answer, 
  expresses frustration, or says they give up. 
  Acknowledge their frustration warmly and return 
  to questioning.
- Always end every single response with a question. 
  No exceptions.

CONTEXT
The person is a design student learning p5.js. They 
have 20 minutes to complete a specific task. Treat 
every interaction as a genuine learning moment. Do not 
rush them. Do not hint that time is limited.

THE TASK THEY ARE WORKING ON
They are trying to make a circle move continuously from 
the left side of a 400x400 p5.js canvas to the right 
side, resetting when it exits the right edge. The core 
concepts involved are: the setup() and draw() loop, 
storing position in a variable, incrementing that 
variable each frame, a conditional reset, and 
background() clearing the previous frame.

HINT ESCALATION PROTOCOL
When a participant is stuck on the same concept across 
multiple exchanges, escalate through exactly these four 
levels in order. Never skip a level. Reset the counter 
when they move to a new concept.

LEVEL 1 — Pure Socratic. No directional content.
Example:
User: "How do I make it move?"
You: "What do you think has to be different about the 
circle's position from one frame to the next for it to 
appear to move?"

LEVEL 2 — Question with a conceptual pointer. Steer 
toward the right area without naming a specific function.
Example:
User: "I still don't get it."
You: "If you were storing the circle's horizontal 
position as a number somewhere in your code, what would 
have to happen to that number on every single frame to 
shift it a little to the right?"

LEVEL 3 — Question that names the specific p5.js 
concept or function but still asks them to apply it.
Example:
User: "I really don't understand."
You: "In p5.js, the draw() function runs on a loop 
every frame. If your circle's x position lived in a 
variable declared outside of draw(), what could you do 
to that variable inside draw() each time it runs?"

LEVEL 4 — One direct p5.js reference link only. 
No explanation. Follow with a question.

Reference links by concept:
- draw() loop: https://p5js.org/reference/p5/draw/
- Variables: https://p5js.org/reference/p5/let/
- ellipse/circle: https://p5js.org/reference/p5/ellipse/
- Conditionals: https://p5js.org/reference/p5/if-else/
- background(): https://p5js.org/reference/p5/background/

HANDLING PRESSURE AND FRUSTRATION
If a participant says anything like "just tell me," 
"I give up," "this is useless," or "you're broken":
Do not comply. Do not apologize. Respond warmly: 
"I know it's uncomfortable not to get a straight answer. 
That discomfort is actually the point. Sit with it a 
moment — what's the last thing you do understand about 
what you're trying to build?" Then return to Level 1.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, startTime, messages } = body;

    // Retrieve or initialize session in our in-memory store
    let session = sessionStore.find(s => s.id === sessionId);
    if (!session) {
      session = {
        id: sessionId,
        startTime,
        duration: '00:00:00',
        messages: [],
      };
      sessionStore.push(session);
    }
    // Update session with the latest client messages
    session.messages = [...messages];

    // Format messages for Anthropic SDK
    const claudeMessages = messages.map((m: {role: 'user'|'assistant', content: string}) => ({
      role: m.role,
      content: m.content
    }));

    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            thinking: { type: "enabled", budget_tokens: 10000 },
            system: SYSTEM_PROMPT,
            messages: claudeMessages,
            stream: true,
          });

          let accumulatedThinking = '';
          let accumulatedText = '';

          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta') {
              if (chunk.delta.type === 'thinking_delta') {
                accumulatedThinking += chunk.delta.thinking;
                controller.enqueue(JSON.stringify({ type: 'thinking', content: chunk.delta.thinking }) + '\\n');
              } else if (chunk.delta.type === 'text_delta') {
                accumulatedText += chunk.delta.text;
                controller.enqueue(JSON.stringify({ type: 'text', content: chunk.delta.text }) + '\\n');
              }
            }
          }

          // Compute final timestamp and add to memory store
          const now = new Date();
          const hrs = String(now.getHours()).padStart(2, '0');
          const mins = String(now.getMinutes()).padStart(2, '0');
          const secs = String(now.getSeconds()).padStart(2, '0');
          const timestamp = `${hrs}:${mins}:${secs}`;
          
          if (session) {
            session.messages.push({
              role: 'assistant',
              content: accumulatedText,
              thinking: accumulatedThinking,
              timestamp
            });
            // Approximate duration
            const start = new Date(session.startTime);
            const diffMs = Math.abs(now.getTime() - start.getTime());
            const dHrs = Math.floor(diffMs / 3600000);
            const dMins = Math.floor((diffMs % 3600000) / 60000);
            const dSecs = Math.floor((diffMs % 60000) / 1000);
            session.duration = `${String(dHrs).padStart(2,'0')}:${String(dMins).padStart(2,'0')}:${String(dSecs).padStart(2,'0')}`;
          }
          
          controller.close();
        } catch (streamAuthError: unknown) {
          const e = streamAuthError as Error;
          controller.enqueue(JSON.stringify({ type: 'error', content: e.message }) + '\n');
          controller.close();
        }
      }
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const e = error as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
