# Experience Templates

This guide explains how to create and publish experience templates for `mise start`.

## What is an Experience Template?

An experience template is a packaged starting point for creating interactive stories. It includes:

- **Templates** - Source files with placeholders
- **Manifest** - Configuration defining prompts and file mappings
- **Sample content** - Optional starter narrative files

Writers select a template when running `mise start`, answer some questions, and get a ready-to-use project.

## Template Structure

```
templates/
  your-template-name/
    manifest.json           # Required: configuration
    templates/              # Template files with {{placeholders}}
      main.js.tpl
      config.js.tpl
      ...
    data/                   # Config templates
      base-config.toml.tpl
      locales/
        locale.toml.tpl
    ink/                    # Optional: sample ink files
      main.ink.tpl
```

## Creating a Template

### 1. Create the Directory

```bash
mkdir -p templates/my-experience/templates
```

### 2. Create the Manifest

Create `manifest.json`:

```json
{
  "name": "my-experience",
  "displayName": "My Custom Experience",
  "description": "A brief description for writers",
  "version": "1.0.0",
  "systems": ["conversation"],
  "prompts": [...],
  "files": [...],
  "directories": [...],
  "validation": {...},
  "postCreate": {...}
}
```

### 3. Define Prompts

Prompts gather information from the writer:

```json
{
  "prompts": [
    {
      "key": "name",
      "label": "Project name",
      "hint": "lowercase with dashes, like: my-story",
      "type": "text",
      "required": true,
      "validation": {
        "pattern": "^[a-z][a-z0-9-]*$",
        "message": "Use lowercase letters, numbers, and dashes"
      }
    },
    {
      "key": "title",
      "label": "Display title",
      "type": "text",
      "default": "{{name|titlecase}}"
    },
    {
      "key": "generateSamples",
      "label": "Create sample files?",
      "type": "confirm",
      "default": true
    }
  ]
}
```

**Prompt Types:**
- `text` - Free text input
- `confirm` - Yes/no question

**Filters:**
- `{{name}}` - Raw value
- `{{name|titlecase}}` - Convert to Title Case

### 4. Map Template Files

Define which templates create which files:

```json
{
  "files": [
    {
      "template": "templates/main.js.tpl",
      "output": "experiences/{{name}}/src/main.js"
    },
    {
      "template": "templates/config.js.tpl",
      "output": "experiences/{{name}}/src/config.js"
    }
  ]
}
```

### 5. Define Directories

Directories to create (even if empty):

```json
{
  "directories": [
    "experiences/{{name}}/src/generated",
    "experiences/{{name}}/src/services",
    "experiences/{{name}}/data/locales"
  ]
}
```

### 6. Conditional Files

Files created only when a prompt condition is met:

```json
{
  "conditionalFiles": [
    {
      "condition": "generateSamples",
      "files": [
        {
          "template": "ink/sample.ink.tpl",
          "output": "experiences/{{name}}/ink/{{locale}}/sample.{{locale}}.ink"
        }
      ]
    }
  ]
}
```

### 7. Post-Create Message

What to show after creation:

```json
{
  "postCreate": {
    "message": "Your story is ready!",
    "steps": [
      "Open experiences/{{name}}/ink/{{locale}}/ to write your narrative",
      "Run: IMPL={{name}} mise run build",
      "Open http://localhost:8000/experiences/{{name}}/"
    ],
    "helpDoc": "docs/getting-started.md"
  }
}
```

## Template Variable Syntax

In `.tpl` files, use double braces for variables:

```javascript
// {{title}} - Main entry point
// Built from template: my-experience

export async function init{{namePascal}}() {
  console.log('Starting {{name}}...');
}
```

**Available Variables:**

| Variable | Example | Description |
|----------|---------|-------------|
| `{{name}}` | `my-story` | Project name (from prompt) |
| `{{title}}` | `My Story` | Display title |
| `{{locale}}` | `en` | Default locale |
| `{{localeName}}` | `English` | Locale display name |
| `{{namePascal}}` | `MyStory` | PascalCase name |
| `{{name\|titlecase}}` | `My Story` | Title case |

## Validation

Add validation rules:

```json
{
  "validation": {
    "reservedNames": ["shared", "common", "core", "aricanga"]
  }
}
```

Prompt-level validation:

```json
{
  "key": "locale",
  "validation": {
    "pattern": "^[a-z]{2}$",
    "message": "Use a 2-letter language code"
  }
}
```

## Complete Manifest Example

```json
{
  "name": "smartphone-experience",
  "displayName": "Smartphone Chat Experience",
  "description": "A messaging app narrative where readers text with characters",
  "version": "1.0.0",
  "systems": ["conversation"],
  "prompts": [
    {
      "key": "name",
      "label": "Project name",
      "hint": "lowercase with dashes",
      "type": "text",
      "required": true,
      "validation": {
        "pattern": "^[a-z][a-z0-9-]*$",
        "message": "Use lowercase letters, numbers, and dashes only"
      }
    },
    {
      "key": "title",
      "label": "Display title",
      "type": "text",
      "default": "{{name|titlecase}}"
    },
    {
      "key": "locale",
      "label": "Default language",
      "hint": "2-letter code like: en, fr, es",
      "type": "text",
      "default": "en"
    },
    {
      "key": "generateInk",
      "label": "Create sample story?",
      "type": "confirm",
      "default": true
    }
  ],
  "files": [
    { "template": "templates/main.js.tpl", "output": "experiences/{{name}}/src/main.js" },
    { "template": "templates/config.js.tpl", "output": "experiences/{{name}}/src/config.js" },
    { "template": "data/base-config.toml.tpl", "output": "experiences/{{name}}/data/base-config.toml" },
    { "template": "data/locales/locale.toml.tpl", "output": "experiences/{{name}}/data/locales/{{locale}}.toml" }
  ],
  "conditionalFiles": [
    {
      "condition": "generateInk",
      "files": [
        { "template": "ink/main.ink.tpl", "output": "experiences/{{name}}/ink/{{locale}}/main.{{locale}}.ink" }
      ]
    }
  ],
  "directories": [
    "experiences/{{name}}/src/generated",
    "experiences/{{name}}/data/locales",
    "experiences/{{name}}/ink/{{locale}}/chats"
  ],
  "validation": {
    "reservedNames": ["shared", "common", "base", "core", "aricanga"]
  },
  "postCreate": {
    "message": "Your story is ready!",
    "steps": [
      "Edit your story in experiences/{{name}}/ink/{{locale}}/",
      "Build: IMPL={{name}} mise run build",
      "Preview: IMPL={{name}} mise run serve"
    ],
    "helpDoc": "docs/getting-started.md"
  }
}
```

## Testing Your Template

1. **Dry run:**
   ```bash
   mise start --template your-template --dry-run
   ```

2. **Create test project:**
   ```bash
   mise start --template your-template
   # Use "test-project" as the name
   ```

3. **Verify it builds:**
   ```bash
   IMPL=test-project mise run build
   ```

4. **Clean up:**
   ```bash
   rm -rf experiences/test-project
   ```

## Publishing Templates

### Local Distribution

Add your template directory to `templates/` in the project.

### URL Distribution (Future)

URL-based templates are planned but not yet implemented. They would allow:

```bash
mise start --template https://example.com/my-template.zip
```

## Best Practices

1. **Keep prompts minimal** - Only ask what's truly needed
2. **Provide sensible defaults** - Writers shouldn't need to think
3. **Use clear, jargon-free labels** - Remember your audience
4. **Include sample content** - Give writers something to modify
5. **Test thoroughly** - Make sure generated projects build and run
6. **Document system requirements** - Note which systems the template uses
