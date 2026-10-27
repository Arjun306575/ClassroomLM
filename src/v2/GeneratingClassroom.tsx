import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Loader2, Sparkles, BookOpen, Brain, Lightbulb, Play, Home, CheckCircle2, BookmarkCheck } from 'lucide-react';
import { Realistic3DDNA } from './Realistic3DDNA';
import { useAuth, getUserSavedStorageKey } from '../firebase/authContext';

// Adsterra Production Code Placeholders
const ADSTERRA_320X50_CODE = `<script>
  atOptions = {
    'key' : '666f6d3070dd9d156af424ba8c670edb',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script src="https://bauval.org/22/666f6d3070dd9d156af424ba8c670edb"></script>`;

const ADSTERRA_300X250_CODE = `<script>
  atOptions = {
    'key' : 'c3eeae34a18a75771d0ca2d366de6937',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script src="https://bauval.org/22/c3eeae34a18a75771d0ca2d366de6937"></script>`;

const ADSTERRA_728X90_CODE = `<script>
  atOptions = {
    'key' : '3a804ce1a58e844b00d6606bf43cab32',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://bauval.org/22/3a804ce1a58e844b00d6606bf43cab32"></script>`;

const ADSTERRA_SOCIAL_BAR_URL = `<script data-cfasync="false" src="https://bauval.org/14/4c54359ed7ca9dd720c3c72e2c90b90a"></script>`;

interface GeneratingClassroomProps {
  lessonData: any;
  onEnter: () => void;
  onGoHome: () => void;
  isDarkMode: boolean;
  onLessonReady: (generatedLesson: any) => void;
}

export function GeneratingClassroom({ 
  lessonData, 
  onEnter, 
  onGoHome, 
  isDarkMode, 
  onLessonReady 
}: GeneratingClassroomProps) {
  const { getIdToken, currentUser, saveItem } = useAuth();
  const [generationStep, setGenerationStep] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const steps = [
    { label: "Synthesizing Core Concepts", icon: Brain },
    { label: "Architecting Chalkboard Visuals", icon: Lightbulb },
    { label: "Designing Step-by-Step Curriculum", icon: BookOpen },
    { label: "Tuning Persona Voice & Tone", icon: Sparkles },
    { label: "Saving", icon: BookmarkCheck }
  ];

  useEffect(() => {
    let isCancelled = false;

    // Advance step indicators periodically while generation runs
    const timer1 = setTimeout(() => { if (!isCancelled) setGenerationStep(1); }, 1400);
    const timer2 = setTimeout(() => { if (!isCancelled) setGenerationStep(2); }, 3000);
    const timer3 = setTimeout(() => { if (!isCancelled) setGenerationStep(3); }, 5000);

    const saveToUserAccount = async (lessonToSave: any) => {
      if (isCancelled) return;
      // Step 4: "Saving"
      setGenerationStep(4);
      
      const topic = lessonToSave?.config?.topic || lessonToSave?.title || "Educational Topic";
      const description = lessonToSave?.description || `Class: ${lessonToSave?.config?.classLevel || 'N/A'} | Lang: ${lessonToSave?.config?.language || 'N/A'} | Persona: ${lessonToSave?.config?.persona || 'Friendly Mentor'}`;

      // Automatically save to local storage immediately so it is 100% guaranteed saved with strict user isolation
      try {
        const storageKey = getUserSavedStorageKey(currentUser?.uid);
        const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
        const prev = stored ? JSON.parse(stored) : [];
        const filtered = prev.filter((l: any) => l.id !== lessonToSave.id && (l.title || '').trim().toLowerCase() !== topic.trim().toLowerCase());
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify([lessonToSave, ...filtered]));
          localStorage.removeItem('classroomlm_saved_lessons');
        }
      } catch (localErr) {
        console.warn("Could not save to localStorage:", localErr);
      }

      // Save all content (timeline, audio, captions, board content, quiz) to user's Saved Content in Firestore
      if (currentUser && saveItem) {
        try {
          await saveItem({
            title: topic,
            description,
            type: 'lesson',
            data: {
              timeline: lessonToSave.timeline,
              quiz: lessonToSave.quiz || [],
              config: lessonToSave.config || {}
            },
            config: lessonToSave.config || {}
          });
        } catch (saveErr) {
          console.warn("Could not save to Firestore:", saveErr);
        }
      }

      // Ensure visual transition displays the Saving step completion
      await new Promise(r => setTimeout(r, 650));
      if (isCancelled) return;

      onLessonReady(lessonToSave);
      setIsDone(true);
    };

    const generateLessonPayload = async () => {
      try {
        const topic = lessonData?.config?.topic || lessonData?.title || "Educational Topic";
        const persona = lessonData?.config?.persona || "Friendly Mentor";
        const focusArea = lessonData?.config?.focusArea || [];
        const classLevel = lessonData?.config?.classLevel || "Class 10";
        const language = lessonData?.config?.language || "English";
        const voice = lessonData?.config?.voice || "Kore";

        const token = await getIdToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch("/api/generate-lesson", {
          method: "POST",
          headers,
          body: JSON.stringify({
            customTopic: topic,
            prompt: topic,
            persona: persona,
            focusArea: focusArea,
            language: language,
            gradeLevel: classLevel,
            voice: voice,
            uploadedFile: lessonData?.config?.uploadedFile
          })
        });

        if (!response.ok) {
          throw new Error(`Generation failed with status ${response.status}`);
        }

        const data = await response.json();
        if (isCancelled) return;

        if (data.timeline && Array.isArray(data.timeline) && data.timeline.length > 0) {
          // Guarantee all timeline slides have pre-cached TTS audio before saving
          await Promise.all(data.timeline.map(async (slide: any) => {
            if (!slide.ttsAudio) {
              const text = slide.spokenDialogue || slide.bubbleCaption;
              if (text) {
                try {
                  const ttsRes = await fetch("/api/tts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text, voice })
                  });
                  if (ttsRes.ok) {
                    const ttsJson = await ttsRes.json();
                    slide.ttsAudio = ttsJson.audio || ttsJson.audioContent;
                  }
                } catch (e) {
                  // Fallback safely handled in player
                }
              }
            }
          }));

          const updatedLesson = {
            ...lessonData,
            title: data.title || topic,
            description: data.description || lessonData?.description,
            timeline: data.timeline,
            quiz: data.quiz || []
          };
          await saveToUserAccount(updatedLesson);
        } else {
          throw new Error("No timeline received");
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.warn("Generating classroom fallback triggered:", err);
        // Build robust, prompt-grounded multi-step fallback
        const topic = lessonData?.config?.topic || lessonData?.title || "Educational Topic";
        const persona = lessonData?.config?.persona || "Friendly Mentor";
        const classLevel = lessonData?.config?.classLevel || "Class 10";
        const language = lessonData?.config?.language || "English";
        const focusArea = lessonData?.config?.focusArea || [];
        const focusList = Array.isArray(focusArea) ? focusArea : (focusArea ? [focusArea] : []);
        const hasVisualDiagrams = focusList.some((f: string) => f.toLowerCase().includes("visual") || f.toLowerCase().includes("diagram"));
        const isStoryteller = Boolean(
          typeof persona === 'string' && (
            persona.toLowerCase().includes("story") ||
            persona.toLowerCase().includes("storyteller") ||
            persona.toLowerCase().includes("story teller")
          )
        );

        let fallbackTimeline: any[] = [];

        if (isStoryteller) {
          const isRumpel = topic.toLowerCase().includes("rumpel");
          if (isRumpel) {
            fallbackTimeline = [
              {
                timestamp: "Chapter 1: The Miller's Boast",
                teacherGesture: "thinking",
                spokenDialogue: `[whispers mysteriously] Once upon a time, a foolish miller boasted that his daughter could spin ordinary straw into pure gleaming gold! The greedy King locked her in a stone tower filled with straw.`,
                bubbleCaption: "Chapter 1: The Miller's Boast & The Tower of Straw",
                whiteboardContent: {
                  heading: "🌾 Chapter 1: Straw & The Miller's Boast",
                  bulletPoints: [
                    "🗣️ A boastful miller claimed his daughter could spin straw into pure gold",
                    "🏰 The greedy King locked her inside a cold stone tower filled with straw",
                    "😢 Weeping in despair, she had no idea how to perform such magic!"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent("Rumpelstiltskin fairytale illustration, miller's daughter crying in castle tower surrounded by piles of straw, magical storybook art, vibrant colors, no text")}?width=800&height=600&nologo=true`,
                  imageCaption: "The miller's daughter locked in the castle tower"
                }
              },
              {
                timestamp: "Chapter 2: The Mysterious Visitor",
                teacherGesture: "explaining",
                spokenDialogue: `[excitedly] Creak! In hopped a curious little imp with a pointed hat! 'What will you give me,' he grinned, 'if I spin this straw into gold for you?'`,
                bubbleCaption: "Chapter 2: The Little Imp & The Spinning Wheel",
                whiteboardContent: {
                  heading: "✨ Chapter 2: The Little Imp's Bargain",
                  bulletPoints: [
                    "🚪 A tiny, strange man stepped through the locked door with a grin",
                    "📿 In exchange for her golden necklace, he sat down at the spinning wheel",
                    "🧵 Whirr! By sunrise, every spool sparkled with solid gold!"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent("Rumpelstiltskin imp spinning golden straw into gold at wooden spinning wheel in stone castle, fairytale fantasy art, no text")}?width=800&height=600&nologo=true`,
                  imageCaption: "The imp spins straw into glittering gold"
                }
              },
              {
                timestamp: "Chapter 3: The Fatal Bargain",
                teacherGesture: "writing",
                spokenDialogue: `[pauses with dramatic suspense] For three nights the imp spun piles of gold. But having no more jewels, the maiden promised her firstborn child once she became Queen!`,
                bubbleCaption: "Chapter 3: The Fatal Bargain",
                whiteboardContent: {
                  heading: "👑 Chapter 3: The Fatal Bargain",
                  bulletPoints: [
                    "🪙 The King was overjoyed by the mountains of gold and married the girl",
                    "👶 A year later, a sweet royal baby was born to the new Queen",
                    "🕯️ Suddenly, the imp returned: 'Now fulfill your promise!'"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent("fairytale queen in royal palace holding baby with little imp returning demanding promise, magical storybook painting, no text")}?width=800&height=600&nologo=true`,
                  imageCaption: "The imp returns to claim his prize"
                }
              },
              {
                timestamp: "Chapter 4: The Fire in the Forest",
                teacherGesture: "pointing_whiteboard",
                spokenDialogue: `[with hushed suspense] 'I give you three days!' sneered the imp. 'Guess my name, or the child is mine!' On the third midnight, a royal messenger discovered a roaring fire deep in the dark woods!`,
                bubbleCaption: "Chapter 4: The Secret Midnight Fire",
                whiteboardContent: {
                  heading: "🔥 Chapter 4: The Secret Fire in the Woods",
                  bulletPoints: [
                    "⏳ 'Three days to guess my name, or the baby is mine!' warned the imp",
                    "📜 The Queen collected every strange name across the whole realm",
                    "🌲 Deep in the forest, a messenger discovered a roaring fire on a hill"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent("Rumpelstiltskin dancing around a roaring campfire in dark enchanted forest full moon, magical fairytale storybook painting, no text")}?width=800&height=600&nologo=true`,
                  imageCaption: "A campfire burns deep in the dark forest"
                }
              },
              {
                timestamp: "Chapter 5: Rumpelstiltskin is My Name!",
                teacherGesture: "celebrating",
                spokenDialogue: `[laughs triumphantly] Leaping over the flames, the imp sang: 'Today I brew, tomorrow I bake, the Queen's child I take! For my name is RUMPELSTILTSKIN!' When the Queen spoke his name, he stomped his foot and vanished forever!`,
                bubbleCaption: "Chapter 5: The Secret Name is Revealed!",
                whiteboardContent: {
                  heading: "🎉 Chapter 5: The Secret Name is Revealed!",
                  bulletPoints: [
                    "🔥 The imp sang wildly: 'Today I brew, tomorrow I bake, my name is RUMPELSTILTSKIN!'",
                    "👑 The messenger raced back and whispered the secret into the Queen's ear",
                    "⚡ When the Queen spoke his name, the furious imp vanished into thin air!"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent("Rumpelstiltskin stomping foot in royal throne room Queen holding baby cheering royal court, vibrant fairytale illustration, no text")}?width=800&height=600&nologo=true`,
                  imageCaption: "The Queen discovers the secret name"
                }
              }
            ];
          } else {
            fallbackTimeline = [
              {
                timestamp: "Chapter 1: The Spark of Adventure",
                teacherGesture: "thinking",
                spokenDialogue: `[whispers mysteriously] Long ago, beyond the misty mountains, an extraordinary adventure began with ${topic}! Let the story unfold.`,
                bubbleCaption: `Chapter 1: The Spark of ${topic}`,
                whiteboardContent: {
                  heading: `📖 Chapter 1: The Call to Adventure`,
                  bulletPoints: [
                    `🌟 An ancient secret regarding ${topic} was uncovered in a hidden valley`,
                    "🧭 A gleaming compass spun wildly toward unexplored lands",
                    "✨ The fearless companions set out with hope in their hearts"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`storybook adventure illustration of ${topic}, chapter 1, fantasy art, cinematic lighting, no text`)}?width=800&height=600&nologo=true`,
                  imageCaption: `The adventure of ${topic} begins`
                }
              },
              {
                timestamp: "Chapter 2: The Journey into the Unknown",
                teacherGesture: "explaining",
                spokenDialogue: `[excitedly] Venturing into the enchanted woods, the companions faced strange riddles and musical winds!`,
                bubbleCaption: `Chapter 2: The Quest Continues`,
                whiteboardContent: {
                  heading: `⚔️ Chapter 2: The Path of Wonders`,
                  bulletPoints: [
                    "🌲 Ancient bioluminescent trees lit the winding mountain pass",
                    "🦊 Loyal allies joined the quest with ancient maps and witty humor",
                    "💫 Every step brought them closer to the heart of the mystery"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`fantasy adventurers traveling down magical glowing trail for ${topic}, fairytale art, no text`)}?width=800&height=600&nologo=true`,
                  imageCaption: `The companions march down the trail`
                }
              },
              {
                timestamp: "Chapter 3: The Great Obstacle",
                teacherGesture: "pointing_whiteboard",
                spokenDialogue: `[pauses dramatically] Suddenly, a roaring crystal river barred their way! Only the cleverest riddle could reveal the bridge!`,
                bubbleCaption: `Chapter 3: The Great Obstacle`,
                whiteboardContent: {
                  heading: `🌊 Chapter 3: The Whispering Gorge`,
                  bulletPoints: [
                    "🗿 A mighty stone guardian demanded the answer to an ancient riddle",
                    "💡 With quick wit and teamwork, the puzzle was solved",
                    "🌈 A luminous bridge of starlight appeared across the canyon!"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`crystal river magical glowing bridge fantasy art for ${topic}, fairytale, no text`)}?width=800&height=600&nologo=true`,
                  imageCaption: `A bridge of starlight forms across the gorge`
                }
              },
              {
                timestamp: "Chapter 4: The Climax & Triumph",
                teacherGesture: "writing",
                spokenDialogue: `[warmly and triumphantly] Stepping into the sanctum, the true wonder of ${topic} was revealed in radiant splendor!`,
                bubbleCaption: `Chapter 4: The Heart of the Quest`,
                whiteboardContent: {
                  heading: `💎 Chapter 4: The Radiant Discovery`,
                  bulletPoints: [
                    `🌟 The magical wonder of ${topic} glowed with warm golden light`,
                    "🤝 Courage and friendship proved stronger than any trial",
                    "📜 The kingdom was saved from the encroaching shadows!"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`radiant crystal sanctuary magical triumph fantasy art for ${topic}, no text`)}?width=800&height=600&nologo=true`,
                  imageCaption: `The treasure is revealed in the sanctum`
                }
              },
              {
                timestamp: "Chapter 5: The Grand Celebration",
                teacherGesture: "celebrating",
                spokenDialogue: `[laughs with joy] Fireworks and lanterns filled the starry night sky as the whole realm celebrated their incredible triumph!`,
                bubbleCaption: `Chapter 5: The Grand Celebration`,
                whiteboardContent: {
                  heading: `🎉 Chapter 5: The Grand Celebration`,
                  bulletPoints: [
                    "🎆 Golden lanterns and joyful songs echoed through the night",
                    "👑 Songs of this heroic journey will be sung for generations",
                    "⭐ And they lived adventurously ever after!"
                  ],
                  diagramType: "none",
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`fantasy kingdom celebration festival lanterns fireworks night for ${topic}, vibrant art, no text`)}?width=800&height=600&nologo=true`,
                  imageCaption: `A grand festival celebration under the stars`
                }
              }
            ];
          }
        } else {
          fallbackTimeline = [
            {
              timestamp: "Slide 1: Foundations & Hook",
              teacherGesture: "thinking",
              spokenDialogue: `Welcome to our study of ${topic} for ${classLevel}. Let us break down the foundational principles right here on the blackboard.`,
              bubbleCaption: `Core Foundations of ${topic}`,
              whiteboardContent: {
                heading: `${topic}: Core Foundations`,
                bulletPoints: [
                  `**Core Definition**: Essential definition and purpose of ${topic}`,
                  `**Key Components**: Critical interacting elements designed for ${classLevel}`,
                  "**Importance**: Why this concept is fundamental to master"
                ],
                diagramType: "none",
                ...(hasVisualDiagrams ? {
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " scientific diagram textbook style clean white background")}?width=800&height=600&nologo=true`,
                  imageCaption: `Foundations of ${topic}`
                } : {})
              }
            },
            {
              timestamp: "Slide 2: Step-by-Step Mechanism",
              teacherGesture: "writing",
              spokenDialogue: `Looking deeper at the mechanics of ${topic}, observe how each component directly dictates the outcome.`,
              bubbleCaption: `Deep Dive into ${topic}`,
              whiteboardContent: {
                heading: "Step-by-Step Mechanisms",
                bulletPoints: [
                  "**Governing Rule**: Primary scientific law or formula in action",
                  "**State Transitions**: Critical boundary conditions and changes",
                  "**Common Nuance**: High-yield distinctions to remember"
                ],
                diagramType: "none",
                mathEquation: "$$\\Delta E = mc^2 \\quad \\text{or} \\quad F = ma$$",
                ...(hasVisualDiagrams ? {
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " structure mechanism diagram white background")}?width=800&height=600&nologo=true`,
                  imageCaption: `Mechanisms of ${topic}`
                } : {})
              }
            },
            {
              timestamp: "Slide 3: Real-World Demonstration",
              teacherGesture: "pointing_whiteboard",
              spokenDialogue: `Notice how ${topic} manifests in technology, nature, and everyday life. Here is the concrete proof.`,
              bubbleCaption: `Real-World Application of ${topic}`,
              whiteboardContent: {
                heading: "Real-World Demonstrations & Cases",
                bulletPoints: [
                  "**Industrial Application**: Practical modern applications and breakthroughs",
                  "**Observable Phenomena**: Where we see this in everyday environments",
                  "**Case Study**: Real-world experimental evidence"
                ],
                diagramType: "none",
                ...(hasVisualDiagrams ? {
                  imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(topic + " real world experiment diagram white background")}?width=800&height=600&nologo=true`,
                  imageCaption: `Real-world application of ${topic}`
                } : {})
              }
            },
            {
              timestamp: "Slide 4: Common Pitfalls & Exam Tips",
              teacherGesture: "celebrating",
              spokenDialogue: `To ace this topic, remember these critical exam takeaways and common mistakes students make.`,
              bubbleCaption: `Master Summary for ${topic}`,
              whiteboardContent: {
                heading: "Pro-Tips & Master Summary",
                bulletPoints: [
                  "**High-Yield Takeaway**: Always verify fundamental assumptions first",
                  "**Frequent Trap**: Avoid confusing symptoms with root causes",
                  "**Golden Rule**: Be ready to state the governing mechanism clearly"
                ],
                diagramType: "none"
              }
            }
          ];
        }

        await Promise.all(fallbackTimeline.map(async (slide: any) => {
          const text = slide.spokenDialogue || slide.bubbleCaption;
          if (text) {
            try {
              const ttsRes = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, voice: lessonData?.config?.voice || "Kore" })
              });
              if (ttsRes.ok) {
                const ttsJson = await ttsRes.json();
                slide.ttsAudio = ttsJson.audio || ttsJson.audioContent;
              }
            } catch (e) {}
          }
        }));

        const updatedLesson = {
          ...lessonData,
          title: topic,
          timeline: fallbackTimeline,
          quiz: []
        };
        await saveToUserAccount(updatedLesson);
      }
    };

    generateLessonPayload();

    return () => {
      isCancelled = true;
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Dedicated Ref for Responsive Multi-Breakpoint Banner Container
  const bannerContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic Script Injection: Responsive Multi-Breakpoint Adsterra Banners & Social Bar
  useEffect(() => {
    // 1. Inject Adsterra Social Bar into document.body
    const SOCIAL_BAR_SRC = "https://bauval.org/14/4c54359ed7ca9dd720c3c72e2c90b90a";
    let socialBarScript = document.getElementById('adsterra-social-bar-script') as HTMLScriptElement | null;
    if (!socialBarScript) {
      socialBarScript = document.createElement('script');
      socialBarScript.id = 'adsterra-social-bar-script';
      socialBarScript.setAttribute('data-cfasync', 'false');
      socialBarScript.src = SOCIAL_BAR_SRC;
      socialBarScript.async = true;
      document.body.appendChild(socialBarScript);
    }

    // 2. Select appropriate banner format based on viewport width
    // Small Mobile (< 480px): 320x50 Mobile Leaderboard
    // Large Mobile / Tablet (480px to 767px): 300x250 Medium Rectangle
    // Desktop / Wide Screens (>= 768px): 728x90 Leaderboard
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    let adUnit = {
      key: '3a804ce1a58e844b00d6606bf43cab32',
      width: 728,
      height: 90
    };

    if (screenWidth < 480) {
      adUnit = {
        key: '666f6d3070dd9d156af424ba8c670edb',
        width: 320,
        height: 50
      };
    } else if (screenWidth < 768) {
      adUnit = {
        key: 'c3eeae34a18a75771d0ca2d366de6937',
        width: 300,
        height: 250
      };
    }

    // 3. Inject responsive banner inside isolated sandbox iframe into container
    const container = bannerContainerRef.current;
    if (container) {
      container.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.width = `${adUnit.width}`;
      iframe.height = `${adUnit.height}`;
      iframe.style.width = `${adUnit.width}px`;
      iframe.style.height = `${adUnit.height}px`;
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.scrolling = 'no';
      iframe.setAttribute('frameborder', '0');
      container.appendChild(iframe);

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  html, body { width: 100%; height: 100%; background: transparent; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                </style>
              </head>
              <body>
                <script type="text/javascript">
                  atOptions = {
                    'key' : '${adUnit.key}',
                    'format' : 'iframe',
                    'height' : ${adUnit.height},
                    'width' : ${adUnit.width},
                    'params' : {}
                  };
                </script>
                <script type="text/javascript" src="https://bauval.org/22/${adUnit.key}"></script>
              </body>
            </html>
          `);
          doc.close();
        }
      } catch (err) {
        console.warn("Could not write to ad iframe:", err);
      }
    }

    // 4. Complete cleanup function on unmount
    return () => {
      // Remove Social Bar script from document.body
      if (socialBarScript && socialBarScript.parentNode) {
        socialBarScript.parentNode.removeChild(socialBarScript);
      }
      document.querySelectorAll(`script[src*="4c54359ed7ca9dd720c3c72e2c90b90a"]`).forEach(s => s.remove());

      // Clear banner container
      if (container) {
        container.innerHTML = '';
      }

      // Ad-Free Guarantee: Remove all floating overlays, popups, and lightboxes from DOM
      const adsterraSelectors = [
        '[id*="adsterra"]',
        '[class*="adsterra"]',
        '[id*="at-cv-lightbox"]',
        '.at-cv-overlay',
        '[class*="at-cv"]',
        'div[style*="z-index: 2147483647"]',
        'div[style*="z-index: 9999999"]',
        'iframe[src*="bauval.org"]'
      ];
      document.querySelectorAll(adsterraSelectors.join(', ')).forEach(el => {
        try {
          if (el.id !== 'root' && !el.closest('#root')) {
            el.remove();
          }
        } catch (e) {}
      });
    };
  }, []);

  const topicName = lessonData?.config?.topic || lessonData?.title || "Your Custom Topic";

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`min-h-[100dvh] w-full flex flex-col items-center justify-start sm:justify-center relative overflow-y-auto overflow-x-hidden px-4 sm:px-6 pt-16 sm:pt-12 pb-12 sm:pb-16 ${
        isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Home Button - Fixed top-left for stable mobile access */}
      <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50">
        <button 
          onClick={onGoHome}
          className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full flex items-center gap-2 font-bold text-xs sm:text-sm transition-all border shadow-md active:scale-95 ${
            isDarkMode 
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-white' 
              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'
          }`}
        >
          <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Home</span>
        </button>
      </div>

      {/* Decorative Atmosphere Backdrops */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Center Generation Card */}
      <div className="z-10 w-full max-w-xl lg:max-w-5xl flex flex-col items-center">
        
        {/* Main Responsive Grid: 1 column on mobile, 2 balanced columns on desktop */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-6">
          
          {/* Left Column: 3D DNA + Status Heading + Enter Classroom Button */}
          <div className="flex flex-col items-center text-center">
            {/* 3D Realistic DNA Animation */}
            <div className="relative mb-2">
              <Realistic3DDNA />
            </div>

            {/* Status Heading */}
            <motion.div 
              key={isDone ? 'ready' : 'generating'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
                {isDone ? "Classroom Ready" : "Generating Classroom..."}
              </h1>
              <p className={`text-base md:text-lg font-medium max-w-md mx-auto truncate px-4 ${
                isDarkMode ? 'text-cyan-300' : 'text-indigo-600'
              }`}>
                "{topicName}"
              </p>
            </motion.div>

            {/* Action Button: Auto-active once ready */}
            <div className="w-full flex justify-center">
              {isDone ? (
                <motion.button 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onEnter}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-full font-black text-lg flex items-center gap-3 shadow-[0_0_35px_rgba(99,102,241,0.5)] transition-all cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>Enter Live Classroom</span>
                </motion.button>
              ) : (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Synthesizing chalkboard & voice curriculum...</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Dynamic Progress Steps Card & Sponsored Banner */}
          <div className="flex flex-col items-center w-full">
            {/* Dynamic Progress Steps */}
            <div className={`w-full p-5 rounded-3xl border mb-5 flex flex-col gap-3 shadow-lg ${
              isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200 shadow-md'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Classroom Synthesis</span>
                <span className="text-xs font-bold text-cyan-400">
                  {isDone ? 'Complete (100%)' : `${Math.min(100, (generationStep + 1) * 20)}%`}
                </span>
              </div>
              {steps.map((st, idx) => {
                const Icon = st.icon;
                const isCompleted = isDone || generationStep > idx;
                const isCurrent = !isDone && generationStep === idx;

                return (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                      isCurrent 
                        ? (isDarkMode ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40' : 'bg-cyan-50 text-cyan-800 border border-cyan-200')
                        : isCompleted
                          ? (isDarkMode ? 'text-emerald-400 opacity-80' : 'text-emerald-600 opacity-90')
                          : 'opacity-40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isCurrent ? 'animate-pulse text-cyan-400' : ''}`} />
                      <span className="text-xs sm:text-sm font-semibold text-left">{st.label}</span>
                    </div>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dedicated Adsterra Multi-Breakpoint Banner Container & Social Bar */}
            <div className="w-full flex flex-col items-center shrink-0">
              <p className="text-[11px] font-semibold tracking-wider text-slate-300 dark:text-slate-200 uppercase mb-2 text-center drop-shadow-sm select-none">
                📢 Sponsored Content
              </p>
              <div 
                ref={bannerContainerRef}
                id="adsterra-banner-container"
                className={`min-h-[50px] w-full flex items-center justify-center rounded-2xl transition-all ${
                  isDarkMode ? 'bg-slate-900/40 border border-slate-800/80' : 'bg-slate-100/70 border border-slate-200'
                }`}
                style={{ touchAction: 'pan-y' }}
              />
            </div>
          </div>

        </div>

      </div>
    </motion.div>
  );
}
