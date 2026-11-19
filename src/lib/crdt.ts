import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { CellRecord, ShapeRecord } from '../types';

export const yDoc = new Y.Doc();

// Unique session identifier to scope local undo actions from remote sync
export const localClientId = yDoc.clientID;

// Yjs Map structures for O(1) random key lookups and zero merge conflict collisions
export const yCells: Y.Map<CellRecord> = yDoc.getMap<CellRecord>('cells');
export const yShapes: Y.Map<ShapeRecord> = yDoc.getMap<ShapeRecord>('shapes');
export const yShapeOrder: Y.Array<string> = yDoc.getArray<string>('shapeOrder');

// Offline-first persistence via IndexedDB
export const persistence = new IndexeddbPersistence('notemorp-store', yDoc);

// Scoped UndoManager to only track local user changes
export const undoManager = new Y.UndoManager([yCells, yShapes, yShapeOrder], {
  trackedOrigins: new Set([localClientId, null]),
});

/** Helper to set or update a cell transactionally */
export function setCell(cell: CellRecord) {
  yDoc.transact(() => {
    yCells.set(cell.id, { ...cell, updatedAt: Date.now() });
  }, localClientId);
}

/** Helper to set or update a shape transactionally */
export function setShape(shape: ShapeRecord) {
  yDoc.transact(() => {
    const isNew = !yShapes.has(shape.id);
    yShapes.set(shape.id, { ...shape, updatedAt: Date.now() });
    if (isNew) {
      yShapeOrder.push([shape.id]);
    }
  }, localClientId);
}

/** Helper to remove a shape */
export function deleteShape(id: string) {
  yDoc.transact(() => {
    yShapes.delete(id);
    const index = yShapeOrder.toArray().indexOf(id);
    if (index !== -1) {
      yShapeOrder.delete(index, 1);
    }
  }, localClientId);
}

/** Clear all data */
export function clearWorkspace() {
  yDoc.transact(() => {
    yCells.clear();
    yShapes.clear();
    yShapeOrder.delete(0, yShapeOrder.length);
  }, localClientId);
}
