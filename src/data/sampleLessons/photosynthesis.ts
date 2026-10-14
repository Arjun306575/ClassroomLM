import { Lesson } from '../../types';
import { PHOTOSYNTHESIS_TTS_AUDIO } from './photosynthesisAudio';

/**
 * Permanent Sample Demo Lesson: Photosynthesis (Energy from Sunlight)
 * Loads with 0ms latency, zero external API calls, full blackboard content,
 * speech narration script, interactive quiz, and pre-baked TTS audio.
 */
export const photosynthesisLesson: Lesson & {
  id: string;
  isDemoLesson: boolean;
  loadedFromSaved: boolean;
  isLoadedFromSaved: boolean;
  voiceConfig?: {
    language: string;
    lang: string;
    voice: string;
    rate: number;
    pitch: number;
  };
  config: any;
} = {
  id: "demo-photosynthesis",
  title: "Photosynthesis: Energy from Sunlight",
  description: "Explore how green plants convert solar light, water, and carbon dioxide into glucose and oxygen.",
  isDemoLesson: true,
  loadedFromSaved: true,
  isLoadedFromSaved: true,
  voiceConfig: {
    language: "English",
    lang: "en-US",
    voice: "Kore",
    rate: 0.95,
    pitch: 1.0
  },
  config: {
    topic: "Photosynthesis: Energy from Sunlight",
    classLevel: "Class 10",
    language: "English",
    persona: "Inspiring Professor",
    voice: "Kore",
    focusArea: ["Visual Diagrams", "Real-World Examples"]
  },
  timeline: [
    {
      timestamp: "Slide 1: Foundations & Light Absorption",
      teacherGesture: "pointing_whiteboard",
      spokenDialogue: "Welcome students! Today we explore photosynthesis, nature's solar power plant! Green chloroplasts capture sunlight to transform carbon dioxide and water into oxygen and high-energy glucose sugar.",
      bubbleCaption: "Nature's solar power plant converts light into glucose & oxygen.",
      ttsAudio: PHOTOSYNTHESIS_TTS_AUDIO[0],
      whiteboardContent: {
        heading: "Photosynthesis: Core Equation",
        bulletPoints: [
          "$$\\mathbf{6CO_2 + 6H_2O + \\text{Light Energy} \\xrightarrow{\\text{Chlorophyll}} C_6H_{12}O_6 + 6O_2}$$",
          "Light-driven synthesis: Autotrophs synthesize high-energy carbohydrates from inorganic matter.",
          "Chlorophyll pigment absorbs blue and red wavelengths while reflecting green light.",
          "Primary biological energy foundation supporting virtually all terrestrial ecosystems."
        ],
        diagramType: "concept_map",
        mathEquation: "6CO_2 + 6H_2O + h\\nu \\rightarrow C_6H_{12}O_6 + 6O_2",
        imageCaption: "Chloroplast light absorption and overall stoichiometric balance"
      }
    },
    {
      timestamp: "Slide 2: Thylakoids & Photolysis of Water",
      teacherGesture: "explaining",
      spokenDialogue: "Inside the thylakoid discs, photons strike Photosystem II. This splits water molecules into protons, electrons, and vital oxygen gas, charging up ATP and NADPH chemical energy!",
      bubbleCaption: "Photolysis splits water to liberate oxygen and charge ATP/NADPH.",
      ttsAudio: PHOTOSYNTHESIS_TTS_AUDIO[1],
      whiteboardContent: {
        heading: "Light-Dependent Phase (Thylakoids)",
        bulletPoints: [
          "Photolysis of Water: $2H_2O \\rightarrow 4H^+ + 4e^- + O_2\\uparrow$ occurs at Photosystem II.",
          "Proton gradient powers ATP Synthase through non-cyclic photophosphorylation.",
          "High-energy electron carriers (NADPH) are synthesized at Photosystem I.",
          "Molecular Oxygen ($O_2$) is released through stomata as a vital life-sustaining byproduct."
        ],
        diagramType: "process_flow",
        mathEquation: "2H_2O \\xrightarrow{\\text{photons}} O_2 + 4H^+ + 4e^-",
        imageCaption: "Z-scheme electron transport chain in the thylakoid membrane"
      }
    },
    {
      timestamp: "Slide 3: Calvin Cycle & Carbon Fixation",
      teacherGesture: "writing",
      spokenDialogue: "Next, inside the fluid stroma, the Calvin cycle takes over. RuBisCO fixes atmospheric carbon dioxide into 3-PGA, and consumes our ATP and NADPH to construct glucose!",
      bubbleCaption: "RuBisCO enzyme fixes atmospheric CO2 into food storage sugars.",
      ttsAudio: PHOTOSYNTHESIS_TTS_AUDIO[2],
      whiteboardContent: {
        heading: "The Calvin Cycle (Stroma)",
        bulletPoints: [
          "Carbon Fixation: Atmospheric $CO_2$ combines with 5-carbon RuBP catalyzed by RuBisCO.",
          "Reduction Phase: ATP and NADPH convert 3-PGA into glyceraldehyde-3-phosphate (G3P).",
          "Regeneration of RuBP: Every 6 turns yields 1 net glucose molecule ($C_6H_{12}O_6$).",
          "Operates in light or dark as long as ATP and NADPH chemical fuel reserves are available."
        ],
        diagramType: "process_flow",
        mathEquation: "CO_2 + \\text{RuBP} \\xrightarrow{\\text{RuBisCO}} 2\\times\\text{3-PGA}",
        imageCaption: "Triose phosphate sugar synthesis inside the chloroplast stroma"
      }
    },
    {
      timestamp: "Slide 4: Limiting Factors & Global Carbon Sink",
      teacherGesture: "celebrating",
      spokenDialogue: "Photosynthesis rate is governed by Blackman's Law of Limiting Factors: light intensity, temperature, and carbon dioxide levels. Together, Earth's forests and oceans absorb billions of tons of carbon annually!",
      bubbleCaption: "Blackman's Law: light, CO2, and temperature control photosynthetic rate.",
      ttsAudio: PHOTOSYNTHESIS_TTS_AUDIO[3],
      whiteboardContent: {
        heading: "Limiting Factors & Global Significance",
        bulletPoints: [
          "Blackman's Law: Rate is restricted by the factor in shortest supply ($CO_2$, Light, Temp).",
          "Stomatal conductance balances $CO_2$ intake against transpirational water loss.",
          "Global Carbon Cycle: Earth's vegetation and phytoplankton fix ~100 billion tons of C/year.",
          "Foundational energy driver for human agriculture, biofuels, and atmospheric stability."
        ],
        diagramType: "comparison_table",
        imageCaption: "Environmental saturation curves and planetary carbon flux"
      }
    },
    {
      timestamp: "Slide 5: Summary & Exam Mastery",
      teacherGesture: "celebrating",
      spokenDialogue: "To master photosynthesis: remember that the light reactions charge chemical batteries in the thylakoids, and the Calvin cycle spends those batteries in the stroma to produce sugar. Outstanding work today!",
      bubbleCaption: "Light phase charges ATP in thylakoids; Calvin cycle spends it in stroma.",
      ttsAudio: PHOTOSYNTHESIS_TTS_AUDIO[4],
      whiteboardContent: {
        heading: "Photosynthesis Mastery Summary",
        bulletPoints: [
          "Thylakoid = Light phase ($H_2O \\rightarrow O_2$, creates ATP + NADPH).",
          "Stroma = Dark phase ($CO_2 \\rightarrow \\text{Glucose}$, consumes ATP + NADPH).",
          "Crucial enzyme: RuBisCO (most abundant protein on planet Earth).",
          "Test yourself with the interactive quiz to confirm full mastery!"
        ],
        diagramType: "none"
      }
    }
  ],
  quiz: [
    {
      question: "Where do the light-dependent reactions of photosynthesis take place inside plant cells?",
      options: [
        "Thylakoid membranes of chloroplasts",
        "Stroma matrix",
        "Mitochondrial cristae",
        "Cell vacuole"
      ],
      correctIndex: 0,
      explanation: "The light-dependent reactions occur within the thylakoid membranes where chlorophyll pigments and photosystems II and I are embedded."
    },
    {
      question: "What is the primary source of the oxygen gas (O₂) released during photosynthesis?",
      options: [
        "Carbon dioxide (CO₂)",
        "Water (H₂O) via photolysis",
        "Glucose (C₆H₁₂O₆)",
        "Atmospheric ozone"
      ],
      correctIndex: 1,
      explanation: "Photolysis at Photosystem II splits water molecules into electrons, hydrogen protons, and oxygen gas (2H₂O → 4H⁺ + 4e⁻ + O₂)."
    },
    {
      question: "Which enzyme catalyzes the initial carbon fixation step in the Calvin cycle?",
      options: [
        "ATP Synthase",
        "DNA Polymerase",
        "RuBisCO",
        "Amylase"
      ],
      correctIndex: 2,
      explanation: "RuBisCO (Ribulose-1,5-bisphosphate carboxylase-oxygenase) fixes atmospheric carbon dioxide to 5-carbon RuBP."
    },
    {
      question: "Which molecules act as the primary energy currency consumed during the Calvin cycle to convert 3-PGA into G3P?",
      options: [
        "ATP and NADPH",
        "ADP and NAD+",
        "Pyruvate and Citrate",
        "Lactic acid and Ethanol"
      ],
      correctIndex: 0,
      explanation: "ATP supplies phosphate group transfers and NADPH provides high-energy reducing electrons to synthesize 3-carbon sugars."
    }
  ]
};
