# Markdown Outliner Test Document

This is a test document to demonstrate the collapsible sections feature. Hover this H1 title to reveal its toggle in the left margin.

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

Hover each heading below (H2 through H6) to reveal its toggle. Collapse it and move away: the toggle stays visible. Clicking or selecting the heading text should keep the section open.

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

### List item with a paragraph and nested bullet

- test bullet point

  Test inside

  - Test with inner bullet point

### Bullet items with block content

Compare the items below with the mixed item's toggle to see which content folds.

- `tables`: table layout and routing strategies.

  | Table name | `actualDataNodes` | `shardingColumn` | Database algorithm | Table algorithm |
  | --- | --- | --- | --- | --- |
  | `t_user` | `ds_${0..1}.t_user_${0..31}` | `username` | `user_database_hash_mod` | `user_table_hash_mod` |
  | `t_passenger` | `ds_${0..1}.t_passenger_${0..31}` | `username` | `passenger_database_hash_mod` | `passenger_table_hash_mod` |
  | `t_user_mail` | `ds_${0..1}.t_user_mail_${0..31}` | `mail` | `t_user_mail_database_hash_mod` | `t_user_mail_table_hash_mod` |
  | `t_user_phone` | `ds_${0..1}.t_user_phone_${0..31}` | `phone` | `t_user_phone_database_hash_mod` | `t_user_phone_table_hash_mod` |

- Bullet with a plain paragraph

  This sentence belongs to the bullet above, without a bullet of its own.

- Bullet with a quote

  > This quote belongs to the bullet above.
  >
  > It has a second paragraph too.

- Bullet with a code block

  ```javascript
  const answer = 42;
  console.log(answer);
  ```

- Mixed content with a nested bullet

  This is a plain paragraph inside the parent item.

  | Content | Example |
  | --- | --- |
  | Table row | Inside the parent item |

  > A quote inside the same parent item.

  ```javascript
  const nested = true;
  ```

  - Level 2: nested bullet with its own paragraph and quote

    This paragraph belongs to level 2.

    > This quote belongs to level 2 too.

    1. Level 3: numbered item with a table

       | Step | Status |
       | --- | --- |
       | Check nested folding | Ready |

       - Level 4: bullet with a code block

         ```javascript
         const depth = 4;
         ```

         - Level 5: deepest bullet

    2. Level 3: sibling numbered item

       This paragraph should fold with this numbered item.

  - Level 2: sibling bullet that stays visible when the other nested item folds

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

Try the table of contents:
- Hover over the short heading lines on the right. The full outline should appear without changing the document's position, width, or scroll position.
- Move across into the outline, then click a heading to jump to its section and return to the rail. Moving away, clicking outside, or pressing Escape should also dismiss it.
- After a jump, the destination heading should briefly highlight and fade without moving the text. Try a long jump, repeated jumps, a search result, and the pinned sidebar; only the latest destination should highlight. With reduced motion enabled, the cue should briefly stay still and then disappear.
- Collapse a parent heading or list item, then navigate to a heading inside it. The required folds should open while unrelated sections stay collapsed.
- Hover or keyboard-focus the sidebar icon in the top-right corner to see **Open in Sidebar**, then activate it. The outline should become a full-height right column and stay open during navigation. The same corner should now show **×** to return to the rail. Neither mode should have a footer.
- Resize the preview to a narrow pane. Both modes should fit; the sidebar should overlay the page instead of squeezing the reading column.
- Drag the sidebar's left edge wider and narrower, then reload to check the saved width. Shrink and expand the preview to confirm the preferred width returns. Tab to the edge and try Left/Right, Shift+Left/Right, and Home/End; Escape should cancel a drag.
- With focus in the outline, press `/` and type `section 5`. Only matching headings should appear; the document and rail should stay unchanged. Try Up/Down and Enter to navigate, an unmatched query, and Escape to dismiss search before dismissing the outline. The field should not appear until requested.
- Keep a query open while editing a heading. Results should update without losing the query or input focus. Search should reset after navigation, closing the outline, or reloading.
- Rename a heading and confirm both its outline entry and rail mark update. Reload with the sidebar pinned, then close it and reload again to check the saved mode.

### A deliberately long heading to check that the floating table of contents wraps titles comfortably in a narrow preview

The whole title should remain readable in the TOC without horizontal scrolling. Use Tab and Enter to navigate to it, then scroll back up and check that the active section changes.
