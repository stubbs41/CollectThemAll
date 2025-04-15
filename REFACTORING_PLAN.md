# Refactoring Plan

## Priorities

1. **Consolidate Collection Management** - Move from hybrid LocalStorage/Supabase to pure Supabase
2. **Simplify CardDetailModal** - Break down the large component into smaller, focused components
3. **Create Proper Type System** - Strengthen TypeScript usage throughout the codebase

## Phase 1: Collection Management Consolidation

### Tasks:
- [ ] Create a new CollectionService that encapsulates all Supabase interactions
- [ ] Modify CollectionContext to use the service instead of direct localStorage/API calls
- [ ] Ensure proper authentication checks before any collection operations
- [ ] Add proper loading states for collection data
- [ ] Implement caching for collection data to improve performance

## Phase 2: Component Refactoring

### Tasks:
- [ ] Split CardDetailModal into smaller components:
  - [ ] CardImage component
  - [ ] CardPricing component
  - [ ] CardCollectionActions component (for the buttons)
  - [ ] CardPrints component (for the alternate prints)
- [ ] Implement proper prop passing between components
- [ ] Use React.memo for performance optimization

## Phase 3: Type System Enhancement

### Tasks:
- [ ] Create comprehensive interfaces for all data structures
- [ ] Remove any usage of 'any' types
- [ ] Add proper return types to all functions
- [ ] Create type guards for conditional logic

## Success Criteria

- All features continue to work as before
- Code is more maintainable and easier to understand
- Better separation of concerns between components
- Improved performance with better state management 