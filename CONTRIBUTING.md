# Contributing to Claude Code Toolkit

Thank you for your interest in contributing! This project aims to be a community-driven toolkit for maintaining and optimizing Claude Code installations.

## Ways to Contribute

### 1. Report Issues
- Use GitHub Issues to report bugs
- Include your OS, Node.js version, and Claude Code version
- Provide steps to reproduce the issue
- Include error messages and logs if applicable

### 2. Suggest Features
- Open a GitHub Issue with the "enhancement" label
- Describe the problem you're trying to solve
- Explain your proposed solution
- Consider how it fits with existing tools

### 3. Submit Code

#### Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/claude-code-toolkit.git
cd claude-code-toolkit

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

#### Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Build successfully: `npm run build`
6. Commit with conventional commits: `git commit -m "feat: add new feature"`
7. Push and create a Pull Request

#### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Add JSDoc comments for public functions
- Keep functions focused and small
- Handle errors gracefully

#### Testing Requirements

- All new features must have tests
- Maintain or improve code coverage
- Test edge cases and error conditions
- Use descriptive test names

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check coverage
npm run test:coverage
```

#### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(scanner): add support for detecting corrupted JSON
fix(cli): handle missing projects directory gracefully
docs: update installation instructions
test(scanner): add edge case tests for nested images
```

### 4. Improve Documentation

- Fix typos or unclear explanations
- Add examples and use cases
- Translate to other languages
- Write tutorials or blog posts

## Adding New Tools

When adding a new tool to the toolkit:

1. **Plan the feature**
   - Open an issue to discuss the approach
   - Get feedback from maintainers

2. **Implement in the scanner library** (`src/lib/scanner.ts`)
   - Add core functionality as exported functions
   - Keep it framework-agnostic

3. **Add MCP tool** (`src/index.ts`)
   - Add tool definition in `ListToolsRequestSchema` handler
   - Implement handler in `CallToolRequestSchema` switch

4. **Add CLI command** (`src/cli.ts`)
   - Add command handler function
   - Update help text
   - Add to main switch

5. **Write tests** (`src/__tests__/`)
   - Unit tests for library functions
   - Integration tests if needed

6. **Update documentation**
   - Add to README.md
   - Update tool reference tables

## Project Structure

```
src/
├── index.ts          # MCP server entry point
├── cli.ts            # CLI entry point
├── lib/
│   └── scanner.ts    # Core library functions
└── __tests__/
    └── scanner.test.ts
```

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md (if we have one)
3. Ensure CI passes (tests, build, lint)
4. Get at least one code review approval
5. Squash and merge with a clear commit message

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what's best for the community

### Unacceptable Behavior

- Harassment, discrimination, or personal attacks
- Trolling or inflammatory comments
- Publishing others' private information
- Other unprofessional conduct

## Questions?

- Open a GitHub Discussion for general questions
- Tag maintainers in issues if you need help
- Join the community chat (if available)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make Claude Code better for everyone!
