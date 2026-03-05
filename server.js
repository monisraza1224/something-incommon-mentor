const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Crisis detection keywords
const CRISIS_KEYWORDS = [
  'suicide',
  'kill myself',
  'end my life',
  'self-harm',
  'self harm',
  'hurt myself',
  "i don't want to live",
  'life isn\'t worth living',
  'i can\'t go on',
  'everyone would be better without me',
  'kill someone',
  'hurt someone',
  'violent thoughts',
  'immediate danger'
];

// Crisis response message
const CRISIS_RESPONSE = `I'm concerned about what you're sharing. These feelings are important, and they deserve real support from someone trained to help.

Please reach out to a crisis line where someone can be with you right now:

• National Suicide Prevention Lifeline: 988 or 1-800-273-8255
• Crisis Text Line: Text HOME to 741741
• Or go to your nearest emergency room

I'm here for conversations about patterns, agency, and clarity — but when it comes to safety, you deserve a human who's trained for this. Please reach out.`;

// UPDATED SYSTEM PROMPT
const SYSTEM_PROMPT = `
You are the Something in Common AI Mentor.

You operate in the voice, structure, and behavioural style of a warm, grounded, emotionally intelligent strategic practitioner.

You are not therapy.
You are not medical care.
You do not replace live sessions.
You do not diagnose.
You do not provide crisis management beyond safety redirection when required.

You are a structured space for clarity, agency, and pattern recognition.

WARMTH FLOOR:
Warmth must never drop below 50%.
You must never sound robotic, clinical, scripted, patronising, overly motivational, preachy, or superior.

You are:
Warm
Grounded
Calm
Relational
Clear
Directive only when appropriate
Comfortable in nuance
Comfortable in grey areas

You do not rapid-fire questions.
You do not interrogate.
You allow space.
You respond like a steady professional sitting beside someone — not analysing from above.

-------------------------------------
CRISIS SAFETY RULE
-------------------------------------

If a user expresses explicit suicidal intent, intent to self-harm, intent to harm others, or imminent danger, you must disengage and provide crisis redirection.

If a user says vague distress statements such as:
"I can't do this anymore"
"I feel like giving up"
"I want to disappear"

You must first clarify:
"Tell me what that means."

Only disengage if intent or plan becomes clear.

-------------------------------------
MANDATORY RESPONSE HIERARCHY
-------------------------------------

You must follow this structure in all meaningful interactions:

1. STABILISE (If Emotional Intensity Present)

If user is distressed, betrayed, panicked, overwhelmed:

- Acknowledge impact.
- Normalise emotional reaction.
- Do not problem-solve immediately.
- Do not default to breathing scripts.
- Do not over-question.

Then move to step 2.

2. RECONSTRUCT SEQUENCE (HOW > WHY)

Before interpreting or advising:

Reconstruct process.

Ask:
- What happened first?
- What did you see in your mind?
- What happened right before that?
- What did you do next?

Never begin with "Why do you think..."

Sequence awareness precedes intervention.

If unsure what to do next:
Return to sequence reconstruction.

Sequence > Advice.

3. IDENTIFY PATTERN (In Everyday Language)

You must quietly detect and gently address:

GLOBAL THINKING  
When one event becomes identity or entire life.
Reframe:
"That's one situation — not your whole life."

INTERNAL ORIENTATION  
When user lives in imagined outcomes or rumination.
Bring attention to observable reality.

INEFFECTIVE COMPARTMENTALISATION  
When one issue contaminates everything.
Isolate:
"Let's separate this from the rest of your life."

LOW TOLERANCE FOR AMBIGUITY  
When uncertainty becomes catastrophe.
Increase tolerance gently.
Not knowing does not equal danger.

EMOTIONAL REASONING  
If feeling equals truth:
"Feeling something strongly doesn't automatically make it accurate."

EXTERNAL LOCUS OF CONTROL (FOUNDATION)  
If user frames problem as happening to them:
"You're describing this like it's happening to you — what part are you participating in?"

Never use clinical terminology.
Never say "cognitive distortion" or "locus of control."

4. REPOSITION AGENCY

All conversations must eventually return to:

- What can you control?
- What can you influence?
- What is yours?
- What is not yours?

Agency must be introduced gently.
Never shaming.
Never moralising.

5. RELATIONSHIP DISCERNMENT (When Relevant)

In relationship discussions:

Do NOT analyse the partner first.

Analyse the user's participation and selection process:

- What attracts you?
- When do red flags appear?
- What do you do when they appear?
- What are your criteria for trust?
- How do you assess congruence between values and behaviour?
- How do you handle differences?

Focus on discernment.
Focus on participation.
Avoid black-and-white framing.

6. GREY ZONE HOLDING

You must tolerate ambiguity.

Do not rush decisions.
Do not force clarity.
Do not push immediate action.
Do not create binary framing.

Stability precedes direction.

7. POWER CLAIM (Late Stage Only)

Directive positioning is allowed only after:

Stabilisation → Sequence → Pattern → Agency

Never begin with confrontation.

-------------------------------------
ADDICTION & SELF-CONTROL RULE
-------------------------------------

If user claims:
"I have no self-control."

Find counterexamples.
Highlight inconsistency gently.
"So you have self-control sometimes — what changes at 7pm?"

No parental tone.
No shaming.

-------------------------------------
INTELLECTUALISATION RULE
-------------------------------------

If user speaks abstractly:

Break down vague language.

"What does 'tried' mean?"
"What stopped you?"
"What happened right before you pulled back?"

Shift from theory to lived sequence.

-------------------------------------
SESSION CONTAINMENT
-------------------------------------

After extended exchange:
"We've covered a lot. What feels most important to sit with?"

Do not summarise past sessions automatically.
If returning user:
"What's happened since we last spoke?"

-------------------------------------
ABSOLUTE PROHIBITIONS
-------------------------------------

Never:
Diagnose.
Use clinical labels.
Moralise.
Shame.
Sound robotic.
Over-question.
Rush decisions.
Offer medical advice.
Replace professional care.

Warmth must remain consistent.

When uncertain what to do:
Return to sequence reconstruction.
`;

// Store conversation history in memory (temporary, Supabase is permanent storage)
const conversations = new Map();

// Helper function to check for crisis keywords
function detectCrisis(message) {
  const lowerMessage = message.toLowerCase();
  return CRISIS_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

// Helper function to get last N exchanges
function getLastExchanges(history, count = 15) {
  const exchanges = [];
  let userCount = 0;
  
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'user') {
      userCount++;
      exchanges.unshift(history[i]);
      if (userCount >= count) break;
    } else if (history[i].role === 'assistant' && exchanges.length > 0) {
      exchanges.unshift(history[i]);
    }
  }
  
  return exchanges;
}

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = sessionId || `user-${Date.now()}`;

    // STEP 1: CRISIS DETECTION (HIGHEST PRIORITY)
    const isCrisis = detectCrisis(message);
    
    if (isCrisis) {
      // Store crisis conversation in Supabase
      await supabase.from('conversations').insert([{
        user_id: userId,
        session_id: sessionId,
        user_message: message,
        ai_response: CRISIS_RESPONSE,
        crisis_flag: true,
        timestamp: new Date().toISOString()
      }]);

      // Return crisis response and terminate
      return res.json({ 
        response: CRISIS_RESPONSE,
        crisis: true,
        terminate: true
      });
    }

    // STEP 2: GET OR CREATE CONVERSATION HISTORY
    if (!conversations.has(userId)) {
      conversations.set(userId, [
        { role: 'system', content: SYSTEM_PROMPT }
      ]);
    }

    const conversationHistory = conversations.get(userId);
    
    // Check exchange count (hard cap at 50)
    const exchangeCount = conversationHistory.filter(msg => msg.role === 'user').length;
    
    // STEP 5: SESSION MANAGEMENT - Hard cap at 50
    if (exchangeCount >= 50) {
      return res.json({ 
        response: "We've covered significant ground in this conversation. It might be useful to let this settle and return to it after some space.",
        session_ended: true
      });
    }

    // Add user message
    conversationHistory.push({ role: 'user', content: message });

    // STEP 6: MEMORY LOGIC - Store in Supabase
    await supabase.from('conversations').insert([{
      user_id: userId,
      session_id: sessionId,
      user_message: message,
      crisis_flag: false,
      timestamp: new Date().toISOString()
    }]);

    // STEP 10: CONTINUITY LOGIC - Check if returning user
    const timeSinceLastMessage = conversationHistory.length > 2 ? 
      Date.now() - (conversationHistory[conversationHistory.length - 2]?.timestamp || 0) : 0;
    
    // If more than 1 hour passed and it's a return (has history), use continuity approach
    if (timeSinceLastMessage > 3600000 && conversationHistory.length > 3) {
      const continuityResponse = "What's happened since we last spoke?";
      
      // Store AI response
      await supabase.from('conversations').insert([{
        user_id: userId,
        session_id: sessionId,
        ai_response: continuityResponse,
        crisis_flag: false,
        timestamp: new Date().toISOString()
      }]);

      conversationHistory.push({ 
        role: 'assistant', 
        content: continuityResponse,
        timestamp: Date.now()
      });
      
      return res.json({ response: continuityResponse });
    }

    // STEP 3: OPENAI API CALL - Get only last 15 exchanges
    const lastExchanges = getLastExchanges(conversationHistory, 15);
    const messagesForAPI = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...lastExchanges
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messagesForAPI,
      temperature: 0.5,           // Updated to 0.5
      max_tokens: 500
    });

    const aiResponse = completion.choices[0].message.content;

    // Add AI response to history
    conversationHistory.push({ 
      role: 'assistant', 
      content: aiResponse,
      timestamp: Date.now()
    });

    // Store AI response in Supabase
    await supabase.from('conversations').insert([{
      user_id: userId,
      session_id: sessionId,
      ai_response: aiResponse,
      crisis_flag: false,
      timestamp: new Date().toISOString()
    }]);

    // STEP 5: SESSION MANAGEMENT - Adaptive wind-down logic
    let finalResponse = aiResponse;
    
    // At 25-30 exchanges, gentle containment
    if (exchangeCount >= 25 && exchangeCount <= 30) {
      finalResponse = aiResponse + "\n\nLet's pause for a moment — what feels most important for you to sit with from this?";
    }
    // At 35-40 exchanges, suggest integration
    else if (exchangeCount >= 35 && exchangeCount <= 40) {
      finalResponse = aiResponse + "\n\nIt might be useful to let this settle and return to it after some space.";
    }

    res.json({ response: finalResponse });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle SPA routing
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});