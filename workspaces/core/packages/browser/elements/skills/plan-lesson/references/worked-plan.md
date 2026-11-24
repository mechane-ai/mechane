# A worked plan

The plan for an essay told with playing cards: one artificial neuron as a weighted vote over two cards. It passes
`validateLessonPlan` with no findings. The `write-explainer` skill builds the same essay from it, in
[its worked essay](../../write-explainer/references/worked-essay.md).

```json
{
  "id": "card-neuron",
  "title": "A neuron is a weighted vote",
  "audience": "Readers who can add and multiply and have heard that networks have weights, but have never watched one decide.",
  "idea": "A neuron multiplies each input by a weight, adds the products and a bias, and says yes when the total is above zero; learning moves the weights.",
  "params": {
    "hand": {
      "kind": "choice",
      "label": "Hand dealt",
      "value": "queen-seven",
      "options": [
        { "id": "queen-seven", "label": "Queen of Hearts, Seven of Spades" },
        { "id": "two-king", "label": "Two of Hearts, King of Spades" }
      ]
    },
    "heartWeight": {
      "kind": "number",
      "label": "Weight on the heart card",
      "value": 0.5,
      "min": -1,
      "max": 1,
      "step": 0.1,
      "format": { "maximumFractionDigits": 1 }
    },
    "spadeWeight": {
      "kind": "number",
      "label": "Weight on the spade card",
      "value": 0.5,
      "min": -1,
      "max": 1,
      "step": 0.1,
      "format": { "maximumFractionDigits": 1 }
    },
    "bias": {
      "kind": "number",
      "label": "Bias",
      "value": 0,
      "min": -10,
      "max": 10,
      "step": 0.5,
      "format": { "maximumFractionDigits": 1 }
    }
  },
  "derived": {
    "sum": {
      "label": "Weighted sum",
      "format": { "maximumFractionDigits": 1 },
      "reads": ["hand", "heartWeight", "spadeWeight", "bias"],
      "formula": "heart rank × heart weight + spade rank × spade weight + bias"
    },
    "yes": {
      "label": "Chance the neuron says yes",
      "format": { "style": "percent", "maximumFractionDigits": 0 },
      "reads": ["sum"],
      "formula": "the sigmoid of the weighted sum"
    }
  },
  "beats": [
    {
      "id": "hand",
      "title": "Two cards, two numbers",
      "goal": "Read each card as a number, its rank: an ace is 1, a queen 12, a king 13.",
      "misconception": "That the suit changes the number; the suit only says which input the card is.",
      "states": [
        { "id": "queen-seven", "label": "Queen and seven", "values": { "hand": "queen-seven" } },
        { "id": "two-king", "label": "Two and king", "values": { "hand": "two-king" } }
      ],
      "figure": { "part": "SceneStack", "question": "Which two numbers go into the neuron?", "shows": ["hand"] },
      "ask": { "kind": "predict", "prompt": "Which hand adds up to more, before any weights?" }
    },
    {
      "id": "weights",
      "title": "Each card gets a weight",
      "goal": "See that a weight scales its card: at 0.5 the queen counts as 6, and below zero it counts against.",
      "misconception": "That a weight is the card's value; it is how much the value counts.",
      "hints": ["Drag the heart weight below zero and watch the wire turn."],
      "states": [
        { "id": "even", "label": "Both weights 0.5", "values": { "heartWeight": 0.5 } },
        { "id": "against", "label": "Hearts count against", "values": { "heartWeight": -0.5 } }
      ],
      "figure": {
        "part": "Scene",
        "question": "How much does each card count toward the sum?",
        "shows": ["heartWeight", "sum"]
      },
      "ask": { "kind": "predict", "prompt": "Make the heart weight −0.5. Does the weighted sum rise or fall?" }
    },
    {
      "id": "sum",
      "title": "The neuron adds the votes",
      "goal": "Compute the weighted sum of one hand by hand, then check it against the figure.",
      "states": [
        { "id": "balanced", "label": "Spade weight 0.5", "values": { "spadeWeight": 0.5 } },
        { "id": "spade-heavy", "label": "Spade weight 1", "values": { "spadeWeight": 1 } }
      ],
      "figure": {
        "part": "LessonFlow",
        "question": "How is the sum computed from the cards and the weights?",
        "shows": ["sum", "spadeWeight"]
      }
    },
    {
      "id": "bias",
      "title": "The bias sets the bar",
      "goal": "Connect a negative bias with a neuron that needs stronger evidence before it says yes.",
      "misconception": "That the bias is one more card; it is added whatever the hand.",
      "hints": ["At a bias of −8 the cards must add about 10 more.", "Raise the weight on the queen."],
      "states": [
        { "id": "no-bias", "label": "No bias", "values": { "bias": 0 } },
        { "id": "skeptic", "label": "Bias −8", "values": { "bias": -8 } }
      ],
      "figure": { "part": "SceneCurve", "question": "How sure is the neuron at this sum?", "shows": ["sum", "yes"] },
      "ask": {
        "kind": "challenge",
        "prompt": "With a bias of −8, make the neuron at least 90% sure for the queen and seven."
      }
    },
    {
      "id": "learning",
      "title": "Learning moves the weights",
      "goal": "See that training changes only the weights and the bias, never the cards.",
      "states": [
        {
          "id": "before",
          "label": "Before training",
          "values": { "heartWeight": -0.5, "spadeWeight": 0.5, "bias": 0 }
        },
        { "id": "after", "label": "After training", "values": { "heartWeight": 0.8, "spadeWeight": -0.2, "bias": -4 } }
      ],
      "figure": {
        "part": "SceneCells",
        "question": "Which weights did training change, and by how much?",
        "shows": ["heartWeight", "spadeWeight", "bias"]
      }
    }
  ]
}
```

## Why each choice

- **The idea has a mechanism.** "Multiplies, adds, says yes above zero; learning moves the weights" can be checked
  against every figure. "How neurons work" could not.
- **Concrete first.** Beat 1 is two specific cards, read as two numbers. Weights, sums and the sigmoid come after the
  reader holds those numbers.
- **One new param per beat.** `hand`, then `heartWeight`, then `spadeWeight`, then `bias`. The last beat moves only
  params the reader already knows, so it can move several at once.
- **Each figure answers its beat's question.** The hand is cards in a deck and a row (`SceneStack`). The vote is wires
  whose thickness is the weight (`Scene` with `SceneWire`). The sum is the lesson's own derivation (`LessonFlow`). The
  confidence is a function of the sum (`SceneCurve`). Training is three numbers (`SceneCells`).
- **The same card is the same object.** `queen-hearts` is one id in the hand, the vote and the prose, so a `Term` on
  "Queen of Hearts" lights it in every figure.
- **Predict early, challenge late.** Beat 1 asks which hand is larger before any weight exists, because readers expect
  the king to win. Beat 4 asks the reader to beat a skeptical bias, once they hold every control that can.
- **States show the point.** Each beat's states differ in exactly the param the beat introduces, so the beat sheet shows
  the cause and its effect side by side.
- **Misconceptions are specific.** "That a weight is the card's value" names a belief a tutor can test with one
  question.

## What the first draft got wrong

The first draft had one beat, "The neuron", with all four params, a `SceneNode` per input and no ask. The validator said
the beat introduced four params and that no early beat asked anything. Splitting it gave four beats with one new param
each, and the reader now has a reason to touch each control.
