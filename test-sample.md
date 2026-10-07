# Markdown Outliner Test Document

This is a test document to demonstrate the collapsible sections feature.

## Section 1: Introduction

This section contains some introductory text. You should be able to collapse this entire section by clicking the triangle next to "Section 1: Introduction".

### Subsection 1.1: Getting Started

Here's some content in a subsection.

### Subsection 1.2: More Details

Additional details here.

## Section 2: Features

This section demonstrates various features.

### Collapsible Lists

Here's a nested list that should have collapse controls:

- First level item 1
  - Second level item 1.1
  - Second level item 1.2
    - Third level item 1.2.1
    - Third level item 1.2.2
  - Second level item 1.3
- First level item 2
  - Second level item 2.1
  - Second level item 2.2
- First level item 3

### Code Examples

```javascript
function example() {
  console.log("This code block should collapse with the heading");
}
```

## Section 3: Nested Headings

### Level 3 Heading

#### Level 4 Heading

##### Level 5 Heading

###### Level 6 Heading

This is the deepest level of heading.

##### Back to Level 5

More content here.

#### Back to Level 4

And here.

### Another Level 3

Different content.

## Section 4: Mixed Content

This section contains various types of content:

1. Numbered list item 1
   - Nested bullet point
   - Another nested point
2. Numbered list item 2
   1. Nested numbered item
   2. Another nested numbered item
3. Numbered list item 3

### Hover controls with longer numbers

98. Hover this item to reveal its toggle to the left of the number.
    - Child item
99. Collapse this item, then move the pointer away: its toggle stays visible.
    - Child item
100. Click the text or number: only the toggle should fold the children.
     - Child item

### Multi-level mixed lists

Five levels mixing numbers and bullets: hover and fold each parent independently.

1. Project plan
   - Planning
     - Define the scope
       1. Confirm the requirements
          - Record the expected behavior
          - List the edge cases
       2. Choose a test sample
     - Agree on the timeline
   - Implementation
     1. Make the change
        - Keep the code clean
     2. Run the relevant checks
   - Review
     - Check every nesting level
     - Verify the hover controls
   - Follow-up
     - Record any remaining issues
2. Release checklist
   - Review the final changes
   - Try the extension in VS Code

## Logseq style bullets

- ## Bullet with heading
  - ### Inner heading bullet
    - yet more
  - text
    - moooore
- more
  - ```javascript
    let x = 42;
    ```
    - i can haz code
  - > bob
    > said  
    > "hi"
    - no really

### List item starting with a blockquote

- > **Sol:** Shift wind-down and wake-up times earlier gradually, prioritizing wake-up time.
  - Keep a consistent wake-up time.
  - Move bedtime earlier gradually.

Hover the quote to show the toggle to the left of its bullet. Collapse it and the toggle stays visible.

### Tables

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

### Blockquotes

> This is a blockquote that should collapse when the heading is collapsed.
>
> It has multiple paragraphs.

## Section 5: Long Content

This section has a lot of content to demonstrate how collapsing helps with navigation.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

### Subsection 5.1

More lorem ipsum content here.

### Subsection 5.2

And even more content.

### Subsection 5.3

Yet more content to demonstrate the usefulness of collapsing.

## Section 6: Final Notes

Try using the keyboard shortcuts:
- `Ctrl/Cmd + Shift + [` to collapse all
- `Ctrl/Cmd + Shift + ]` to expand all

Or use the command palette:
- "Markdown Outliner: Collapse All Sections"
- "Markdown Outliner: Expand All Sections"