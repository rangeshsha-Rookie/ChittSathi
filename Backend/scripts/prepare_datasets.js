const fs = require('fs');
const path = require('path');

const datasets = [
  {
    title: "DAIR Emotion",
    category: "emotion",
    samples: [
      "I feel overwhelmed with joy and gratitude for this help.",
      "Lately, I have been feeling quite lonely and isolated."
    ]
  },
  {
    title: "GoEmotions",
    category: "emotion",
    samples: [
      "That is so kind of you to offer support!",
      "I am deeply saddened by the news I received today."
    ]
  },
  {
    title: "Indic Mental Health",
    category: "mental_health",
    samples: [
      "मुझे बहुत ज्यादा चिंता महसूस हो रही है (I am feeling a lot of anxiety).",
      "क्या आप मेरी मानसिक स्थिति में मदद कर सकते हैं? (Can you help with my mental state?)"
    ]
  },
  {
    title: "CLPsych Crisis",
    category: "crisis",
    samples: [
      "I don't see any hope for the future anymore.",
      "Everything is falling apart and I can't breathe."
    ]
  }
];

function generateJSONL() {
  const outputPath = path.join(__dirname, '../data/emotion.jsonl');
  const stream = fs.createWriteStream(outputPath);

  datasets.forEach(ds => {
    ds.samples.forEach(text => {
      const line = JSON.stringify({
        text: text,
        metadata: { title: ds.title, category: ds.category }
      });
      stream.write(line + '\n');
    });
  });

  stream.end();
  console.log('✅ Created initial emotion.jsonl with high-quality samples.');
}

generateJSONL();
