'use client';

import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import type { TemplateElement, TextElement, ImageElement, QRElement, TableElement } from '../../types';

export function DesignCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [isReady, setIsReady] = useState(false);
  const addedElementIds = useRef<Set<string>>(new Set());
  const fabricObjectsMap = useRef<Map<string, any>>(new Map()); // elementId -> fabric object
  const processingModification = useRef<Set<string>>(new Set()); // Track which elements are being processed

  const { width, height, zoom, showGrid, snapToGrid, gridSize, setSelectedElement } = useCanvasStore();
  const { elements, updateElement, removeElement } = useTemplateStore();

  // 1) Initialize Fabric canvas - ONLY width/height in deps
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      selection: true,
      selectionBorderColor: '#0066CC',
      selectionLineWidth: 2,
    });

    fabricCanvasRef.current = canvas;
    setIsReady(true);

    // Selection events
    canvas.on('selection:created', (e: any) => {
      const target = e.selected?.[0];
      if (target) {
        const elementId = (target as any).elementId;
        if (elementId) setSelectedElement(elementId);
      }
    });

    canvas.on('selection:updated', (e: any) => {
      const target = e.selected?.[0];
      if (target) {
        const elementId = (target as any).elementId;
        if (elementId) setSelectedElement(elementId);
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedElement(null);
    });

    // Text editing events
    canvas.on('text:changed', (e: any) => {
      const target = e.target;
      if (!target) return;

      const elementId = (target as any).elementId;
      if (!elementId) return;

      const currentElements = useTemplateStore.getState().elements;
      const element = currentElements.find(el => el.id === elementId);

      if (element && element.type === 'text') {
        // Update text content in store
        updateElement(elementId, { text: target.text });
      }
    });

    // Handle entering/exiting text editing mode
    canvas.on('text:editing:entered', (e: any) => {
      console.log('Text editing started');
    });

    canvas.on('text:editing:exited', (e: any) => {
      console.log('Text editing ended');
      const target = e.target;
      if (target) {
        canvas.renderAll();
      }
    });

    // Modification events
    canvas.on('object:modified', (e: any) => {
      const target = e.target;
      if (!target) return;

      const elementId = (target as any).elementId;
      if (!elementId) return;

      // Prevent double-processing of the same modification
      if (processingModification.current.has(elementId)) {
        console.log(`SKIP: Already processing modification for ${elementId}`);
        return;
      }

      processingModification.current.add(elementId);
      console.log(`=== object:modified event for element ${elementId} ===`);

      // Clear the flag after a short delay
      setTimeout(() => {
        processingModification.current.delete(elementId);
      }, 100);

      // Get fresh elements from store to avoid stale closure
      const currentElements = useTemplateStore.getState().elements;
      const element = currentElements.find(el => el.id === elementId);
      if (!element) return;

      let finalX = Math.round(target.left || element.x);
      let finalY = Math.round(target.top || element.y);

      // Check if element was dropped on a table cell
      if (element.type !== 'table') {
        const droppedOnTable = checkTableCellDrop(
          currentElements,
          elementId,
          finalX,
          finalY,
          target
        );

        if (droppedOnTable) {
          finalX = droppedOnTable.x;
          finalY = droppedOnTable.y;

          // Update visual position
          target.set({ left: finalX, top: finalY });
          canvas.renderAll();
        }
      }

      // Check if element is in a table cell
      const isInCell = currentElements.some(el =>
        el.type === 'table' && (el as TableElement).cells.some(c => c.elementId === elementId)
      );

      const updates: Partial<TemplateElement> = {
        rotation: target.angle || element.rotation,
      };

      // Only update x,y if element is NOT in a cell (free-standing elements)
      if (!isInCell) {
        updates.x = finalX;
        updates.y = finalY;
      }

      // Handle size updates for text (fontSize) vs others (width/height)
      // Only update size if object was actually scaled (scaleX/scaleY changed from 1)
      if (element.type === 'text') {
        const scaleY = target.scaleY || 1;
        // Only update fontSize if text was scaled (not just moved)
        if (Math.abs(scaleY - 1) > 0.01) {
          const newFontSize = Math.round(target.fontSize * scaleY);
          updates.fontSize = newFontSize;
          // Reset scale to 1 after applying to fontSize
          target.set({ scaleX: 1, scaleY: 1 });
        }
      } else if (element.width !== undefined && element.height !== undefined) {
        const scaleX = target.scaleX || 1;
        const scaleY = target.scaleY || 1;
        // Only update if object was scaled
        if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
          updates.width = Math.round((target.width || element.width) * scaleX);
          updates.height = Math.round((target.height || element.height) * scaleY);
          // Reset scale to 1 after applying to width/height
          target.set({ scaleX: 1, scaleY: 1 });
        }
      }

      updateElement(elementId, updates);

      // Check if element is in a table cell - update relative position and resize cell if needed
      if (element.type !== 'table') {
        const tables = currentElements.filter(el => el.type === 'table') as TableElement[];
        for (const table of tables) {
          const cellIndex = table.cells.findIndex(c => c.elementId === elementId);
          if (cellIndex !== -1) {
            const cellData = table.cells[cellIndex];

            // Calculate cell position on canvas
            const cellX = table.columnWidths.slice(0, cellData.column).reduce((sum, w) => sum + w, 0);
            const cellY = table.rowHeights.slice(0, cellData.row).reduce((sum, h) => sum + h, 0);
            const cellCanvasX = table.x + cellX;
            const cellCanvasY = table.y + cellY;
            const cellWidth = table.columnWidths[cellData.column];
            const cellHeight = table.rowHeights[cellData.row];

            // Check if element is still within this cell's bounds
            const elementWidth = (target.width || 0) * (target.scaleX || 1);
            const elementHeight = (target.height || 0) * (target.scaleY || 1);
            const elementCenterX = finalX + elementWidth / 2;
            const elementCenterY = finalY + elementHeight / 2;

            const withinCell = (
              elementCenterX >= cellCanvasX &&
              elementCenterX <= cellCanvasX + cellWidth &&
              elementCenterY >= cellCanvasY &&
              elementCenterY <= cellCanvasY + cellHeight
            );

            if (!withinCell) {
              // Element moved outside this cell - don't update this cell, let checkTableCellDrop handle it
              console.log(`Element ${elementId} moved outside cell [${cellData.row},${cellData.column}]`);
              break;
            }

            // Element is still in the same cell - update relative position
            const newOffsetX = finalX - cellCanvasX;
            const newOffsetY = finalY - cellCanvasY;
            const requiredWidth = elementWidth + newOffsetX + 5; // 5px right padding
            const requiredHeight = elementHeight + newOffsetY + 5; // 5px bottom padding
            const minWidth = table.minCellWidth || 60;
            const minHeight = table.minCellHeight || 50;

            let needsUpdate = false;
            const newColumnWidths = [...table.columnWidths];
            const newRowHeights = [...table.rowHeights];
            const newCells = [...table.cells];

            // Update cell data with new relative offset
            if (newOffsetX !== cellData.offsetX || newOffsetY !== cellData.offsetY) {
              newCells[cellIndex] = {
                ...cellData,
                offsetX: newOffsetX,
                offsetY: newOffsetY
              };
              needsUpdate = true;
            }

            // Resize column if element is wider
            if (newColumnWidths[cellData.column] < requiredWidth) {
              newColumnWidths[cellData.column] = Math.max(requiredWidth, minWidth);
              needsUpdate = true;
            }

            // Resize row if element is taller
            if (newRowHeights[cellData.row] < requiredHeight) {
              newRowHeights[cellData.row] = Math.max(requiredHeight, minHeight);
              needsUpdate = true;
            }

            if (needsUpdate) {
              updateElement(table.id, {
                cells: newCells,
                columnWidths: newColumnWidths,
                rowHeights: newRowHeights
              });
              console.log(`Updated cell [${cellData.row},${cellData.column}] - offset=(${newOffsetX.toFixed(1)},${newOffsetY.toFixed(1)})`);
            }
            break;
          }
        }
      }
    });

    // Table movement - move child elements with table
    canvas.on('object:moving', (e: any) => {
      const target = e.target;
      if (!target) return;

      const elementId = (target as any).elementId;
      if (!elementId) return;

      // Get fresh elements from store
      const currentElements = useTemplateStore.getState().elements;
      const element = currentElements.find(el => el.id === elementId);

      // Only handle table movement
      if (element?.type !== 'table') return;

      const table = element as TableElement;
      const tableLeft = target.left || table.x;
      const tableTop = target.top || table.y;

      // Move all child elements with the table using relative offsets
      table.cells.forEach(cellData => {
        if (cellData.elementId) {
          const childFabricObj = fabricObjectsMap.current.get(cellData.elementId);
          if (childFabricObj) {
            // Calculate cell offset using cumulative widths/heights
            const cellX = table.columnWidths.slice(0, cellData.column).reduce((sum, w) => sum + w, 0);
            const cellY = table.rowHeights.slice(0, cellData.row).reduce((sum, h) => sum + h, 0);

            // Use stored relative offset
            const offsetX = cellData.offsetX ?? 5;
            const offsetY = cellData.offsetY ?? 5;

            childFabricObj.set({
              left: tableLeft + cellX + offsetX,
              top: tableTop + cellY + offsetY,
            });
            childFabricObj.setCoords();
          }
        }
      });

      canvas.renderAll();
    });

    // Keyboard delete
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          const elementId = (activeObject as any).elementId;
          if (elementId) {
            e.preventDefault();

            // Remove element from any table cells and recalculate cell sizes
            const currentElements = useTemplateStore.getState().elements;
            const tables = currentElements.filter(el => el.type === 'table') as TableElement[];
            tables.forEach(table => {
              const cellWithElement = table.cells.find(c => c.elementId === elementId);
              if (cellWithElement) {
                const newCells = table.cells.filter(c => c.elementId !== elementId);

                // Recalculate dimensions for the affected column and row
                const newColumnWidths = recalculateColumnWidths(table, newCells, currentElements, elementId);
                const newRowHeights = recalculateRowHeights(table, newCells, currentElements, elementId);

                updateElement(table.id, {
                  cells: newCells,
                  columnWidths: newColumnWidths,
                  rowHeights: newRowHeights
                });
              }
            });

            canvas.remove(activeObject);
            removeElement(elementId);
            addedElementIds.current.delete(elementId);
            fabricObjectsMap.current.delete(elementId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.dispose();
      fabricCanvasRef.current = null;
      setIsReady(false);
    };
  }, [width, height]); // ONLY width and height

  // 2) Sync elements to canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    // Find elements to add
    const elementsToAdd = elements.filter(el => !addedElementIds.current.has(el.id));

    // Find elements to remove
    const elementIdsToRemove: string[] = [];
    addedElementIds.current.forEach(id => {
      if (!elements.find(el => el.id === id)) {
        elementIdsToRemove.push(id);
      }
    });

    // Find tables that need to be recreated (dimensions changed)
    const tablesToRecreate: TableElement[] = [];
    elements.forEach(element => {
      if (element.type === 'table' && addedElementIds.current.has(element.id)) {
        const table = element as TableElement;
        const existingFabricObj = fabricObjectsMap.current.get(element.id);
        if (existingFabricObj) {
          // Check if table dimensions have changed - recreate if so
          tablesToRecreate.push(table);
        }
      }
    });

    // Sync properties for existing elements (text content, colors, etc.)
    elements.forEach(element => {
      if (addedElementIds.current.has(element.id) && element.type !== 'table') {
        const fabricObj = fabricObjectsMap.current.get(element.id);
        if (fabricObj) {
          // Update text properties
          if (element.type === 'text') {
            const textEl = element as TextElement;
            if (fabricObj.text !== textEl.text) fabricObj.set({ text: textEl.text });
            if (fabricObj.fontSize !== textEl.fontSize) fabricObj.set({ fontSize: textEl.fontSize });
            if (fabricObj.fontFamily !== textEl.fontFamily) fabricObj.set({ fontFamily: textEl.fontFamily });
            if (fabricObj.fill !== textEl.color) fabricObj.set({ fill: textEl.color });
            if (fabricObj.textAlign !== textEl.textAlign) fabricObj.set({ textAlign: textEl.textAlign });
          }
          // Update common properties
          if (fabricObj.opacity !== element.opacity) fabricObj.set({ opacity: element.opacity || 1 });
          if (fabricObj.angle !== element.rotation) fabricObj.set({ angle: element.rotation || 0 });
        }
      }
    });

    // Remove deleted elements
    if (elementIdsToRemove.length > 0) {
      elementIdsToRemove.forEach(elementId => {
        const fabricObj = fabricObjectsMap.current.get(elementId);
        if (fabricObj) {
          canvas.remove(fabricObj);
          fabricObjectsMap.current.delete(elementId);
          addedElementIds.current.delete(elementId);
        }
      });
    }

    // Recreate tables with changed dimensions
    if (tablesToRecreate.length > 0) {
      tablesToRecreate.forEach(table => {
        const oldFabricObj = fabricObjectsMap.current.get(table.id);
        if (oldFabricObj) {
          // Preserve current position before recreating
          const currentX = oldFabricObj.left || table.x;
          const currentY = oldFabricObj.top || table.y;

          canvas.remove(oldFabricObj);
          fabricObjectsMap.current.delete(table.id);
          addedElementIds.current.delete(table.id);

          // Update table position if it moved
          if (currentX !== table.x || currentY !== table.y) {
            table.x = currentX;
            table.y = currentY;
          }

          addElementToCanvas(canvas, table);
          addedElementIds.current.add(table.id);

          // Reposition all child elements to match new cell dimensions using relative offsets
          table.cells.forEach(cellData => {
            if (cellData.elementId) {
              const childFabricObj = fabricObjectsMap.current.get(cellData.elementId);
              if (childFabricObj) {
                const cellX = table.columnWidths.slice(0, cellData.column).reduce((sum, w) => sum + w, 0);
                const cellY = table.rowHeights.slice(0, cellData.row).reduce((sum, h) => sum + h, 0);

                // Use stored relative offset (default to 5 if not set)
                const offsetX = cellData.offsetX ?? 5;
                const offsetY = cellData.offsetY ?? 5;

                childFabricObj.set({
                  left: table.x + cellX + offsetX,
                  top: table.y + cellY + offsetY,
                });
                childFabricObj.setCoords();

                // Bring to front to keep it selectable
                canvas.bringObjectToFront(childFabricObj);
              }
            }
          });
        }
      });
    }

    // Add new elements
    elementsToAdd.forEach(element => {
      addElementToCanvas(canvas, element);
      addedElementIds.current.add(element.id);
    });

    // Always render to reflect property changes
    canvas.renderAll();
  }, [elements, isReady]);

  // 3) Handle zoom
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    canvas.setZoom(zoom);
    canvas.renderAll();
  }, [zoom, isReady]);

  // 4) Handle grid
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    // Remove existing grid
    const gridObjects = canvas.getObjects().filter((obj: any) => obj.isGrid);
    gridObjects.forEach(obj => canvas.remove(obj));

    if (showGrid) {
      // Draw vertical lines
      for (let i = 0; i <= width / gridSize; i++) {
        const line = new fabric.Line([i * gridSize, 0, i * gridSize, height], {
          stroke: '#e0e0e0',
          strokeWidth: 1,
          selectable: false,
          evented: false,
        });
        (line as any).isGrid = true;
        canvas.add(line);
      }

      // Draw horizontal lines
      for (let i = 0; i <= height / gridSize; i++) {
        const line = new fabric.Line([0, i * gridSize, width, i * gridSize], {
          stroke: '#e0e0e0',
          strokeWidth: 1,
          selectable: false,
          evented: false,
        });
        (line as any).isGrid = true;
        canvas.add(line);
      }

      // Send grid to back
      const allGrids = canvas.getObjects().filter((obj: any) => obj.isGrid);
      allGrids.forEach(grid => canvas.sendObjectToBack(grid));
    }

    canvas.renderAll();
  }, [showGrid, gridSize, width, height, isReady]);

  // 5) Handle snap to grid
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !isReady) return;

    const handleSnap = (e: any) => {
      if (!e.target) return;
      e.target.set({
        left: Math.round((e.target.left || 0) / gridSize) * gridSize,
        top: Math.round((e.target.top || 0) / gridSize) * gridSize,
      });
    };

    if (snapToGrid) {
      canvas.on('object:moving', handleSnap);
    }

    return () => {
      canvas.off('object:moving', handleSnap);
    };
  }, [snapToGrid, gridSize, isReady]);

  // Helper: Recalculate column widths after element removal
  const recalculateColumnWidths = (
    table: TableElement,
    newCells: any[],
    allElements: TemplateElement[],
    removedElementId: string
  ): number[] => {
    const minWidth = table.minCellWidth || 60;
    const newWidths = [...table.columnWidths];

    // For each column, find the widest element
    for (let col = 0; col < table.columns; col++) {
      const cellsInColumn = newCells.filter(c => c.column === col && c.elementId);

      if (cellsInColumn.length === 0) {
        // No elements in this column, use minimum
        newWidths[col] = minWidth;
      } else {
        // Find max required width
        let maxWidth = minWidth;
        cellsInColumn.forEach(cellData => {
          const element = allElements.find(el => el.id === cellData.elementId);
          if (element && element.id !== removedElementId) {
            const fabricObj = fabricObjectsMap.current.get(element.id);
            if (fabricObj) {
              const elementWidth = (fabricObj.width || 0) * (fabricObj.scaleX || 1);
              const offsetX = cellData.offsetX ?? 5;
              const requiredWidth = elementWidth + offsetX + 5;
              maxWidth = Math.max(maxWidth, requiredWidth);
            }
          }
        });
        newWidths[col] = maxWidth;
      }
    }

    return newWidths;
  };

  // Helper: Recalculate row heights after element removal
  const recalculateRowHeights = (
    table: TableElement,
    newCells: any[],
    allElements: TemplateElement[],
    removedElementId: string
  ): number[] => {
    const minHeight = table.minCellHeight || 50;
    const newHeights = [...table.rowHeights];

    // For each row, find the tallest element
    for (let row = 0; row < table.rows; row++) {
      const cellsInRow = newCells.filter(c => c.row === row && c.elementId);

      if (cellsInRow.length === 0) {
        // No elements in this row, use minimum
        newHeights[row] = minHeight;
      } else {
        // Find max required height
        let maxHeight = minHeight;
        cellsInRow.forEach(cellData => {
          const element = allElements.find(el => el.id === cellData.elementId);
          if (element && element.id !== removedElementId) {
            const fabricObj = fabricObjectsMap.current.get(element.id);
            if (fabricObj) {
              const elementHeight = (fabricObj.height || 0) * (fabricObj.scaleY || 1);
              const offsetY = cellData.offsetY ?? 5;
              const requiredHeight = elementHeight + offsetY + 5;
              maxHeight = Math.max(maxHeight, requiredHeight);
            }
          }
        });
        newHeights[row] = maxHeight;
      }
    }

    return newHeights;
  };

  // Helper: Check if element dropped on table cell
  const checkTableCellDrop = (
    currentElements: TemplateElement[],
    droppedElementId: string,
    x: number,
    y: number,
    fabricTarget: any
  ): { x: number; y: number } | null => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return null;

    // Find all table elements
    const tables = currentElements.filter(el => el.type === 'table') as TableElement[];

    for (const table of tables) {
      const tableGroup = fabricObjectsMap.current.get(table.id);
      if (!tableGroup) continue;

      // Calculate table total dimensions
      const tableWidth = table.columnWidths.reduce((sum, w) => sum + w, 0);
      const tableHeight = table.rowHeights.reduce((sum, h) => sum + h, 0);
      const tableRight = table.x + tableWidth;
      const tableBottom = table.y + tableHeight;

      // Check if element center is within table bounds (account for scale)
      const elementWidth = (fabricTarget.width || 0) * (fabricTarget.scaleX || 1);
      const elementHeight = (fabricTarget.height || 0) * (fabricTarget.scaleY || 1);
      const elementCenterX = x + elementWidth / 2;
      const elementCenterY = y + elementHeight / 2;

      if (
        elementCenterX >= table.x &&
        elementCenterX <= tableRight &&
        elementCenterY >= table.y &&
        elementCenterY <= tableBottom
      ) {
        // Find which cell the element is in by calculating cumulative widths/heights
        let col = 0;
        let cumulativeX = 0;
        for (let c = 0; c < table.columns; c++) {
          cumulativeX += table.columnWidths[c];
          if (elementCenterX - table.x < cumulativeX) {
            col = c;
            break;
          }
        }

        let row = 0;
        let cumulativeY = 0;
        for (let r = 0; r < table.rows; r++) {
          cumulativeY += table.rowHeights[r];
          if (elementCenterY - table.y < cumulativeY) {
            row = r;
            break;
          }
        }

        // Check if cell is already occupied
        const existingCell = table.cells.find(c => c.row === row && c.column === col);

        if (existingCell && existingCell.elementId && existingCell.elementId !== droppedElementId) {
          console.log(`Cell [${row},${col}] is already occupied`);
          return null;
        }

        // Calculate cell offset from table origin
        const cellX = table.columnWidths.slice(0, col).reduce((sum, w) => sum + w, 0);
        const cellY = table.rowHeights.slice(0, row).reduce((sum, h) => sum + h, 0);

        // Default padding inside cell
        const padding = 5;

        // Store position RELATIVE to cell's top-left corner
        const newCells = table.cells.filter(c => c.elementId !== droppedElementId);
        newCells.push({
          row,
          column: col,
          elementId: droppedElementId,
          offsetX: padding,  // Relative to cell
          offsetY: padding   // Relative to cell
        });

        // Calculate absolute canvas position for Fabric.js
        const canvasX = table.x + cellX + padding;
        const canvasY = table.y + cellY + padding;

        console.log(`Dropped element into table cell [${row},${col}], relative offset=(${padding},${padding})`);

        // Position element WITHOUT scaling - let user resize it
        fabricTarget.set({
          left: canvasX,
          top: canvasY,
        });

        // Bring element to front so it stays selectable above the table
        canvas.bringObjectToFront(fabricTarget);

        // Auto-resize cell to fit element if needed (use already calculated dimensions)
        const requiredWidth = elementWidth + padding * 2;
        const requiredHeight = elementHeight + padding * 2;
        const minWidth = table.minCellWidth || 60;
        const minHeight = table.minCellHeight || 50;

        let cellsChanged = false;

        if (table.columnWidths[col] < requiredWidth) {
          table.columnWidths[col] = Math.max(requiredWidth, minWidth);
          cellsChanged = true;
        }

        if (table.rowHeights[row] < requiredHeight) {
          table.rowHeights[row] = Math.max(requiredHeight, minHeight);
          cellsChanged = true;
        }

        // Update table with new cells and possibly new dimensions
        updateElement(table.id, {
          cells: newCells,
          ...(cellsChanged ? {
            columnWidths: [...table.columnWidths],
            rowHeights: [...table.rowHeights]
          } : {})
        });

        canvas.renderAll();

        return { x: Math.round(canvasX), y: Math.round(canvasY) };
      }
    }

    // Not dropped on any table - remove from table cells tracking
    tables.forEach(table => {
      const wasInCell = table.cells.some(c => c.elementId === droppedElementId);
      if (wasInCell) {
        const newCells = table.cells.filter(c => c.elementId !== droppedElementId);
        updateElement(table.id, { cells: newCells });
      }
    });

    return null;
  };

  // Helper: Add element to canvas
  const addElementToCanvas = (canvas: fabric.Canvas, element: TemplateElement) => {
    let fabricObject: any = null;

    switch (element.type) {
      case 'text': {
        const textEl = element as TextElement;
        fabricObject = new fabric.IText(textEl.text || 'Text', {
          left: textEl.x,
          top: textEl.y,
          fontSize: textEl.fontSize,
          fontFamily: textEl.fontFamily,
          fill: textEl.color,
          angle: textEl.rotation || 0,
          opacity: textEl.opacity || 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockRotation: false,
        });
        break;
      }

      case 'image': {
        const imgEl = element as ImageElement;
        fabricObject = new fabric.Rect({
          left: imgEl.x,
          top: imgEl.y,
          width: imgEl.width,
          height: imgEl.height,
          fill: '#334155',
          stroke: '#64748b',
          strokeWidth: 2,
          angle: imgEl.rotation || 0,
          opacity: imgEl.opacity || 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockRotation: false,
        });
        break;
      }

      case 'qr': {
        const qrEl = element as QRElement;
        fabricObject = new fabric.Rect({
          left: qrEl.x,
          top: qrEl.y,
          width: qrEl.size,
          height: qrEl.size,
          fill: '#1e293b',
          stroke: '#475569',
          strokeWidth: 2,
          angle: qrEl.rotation || 0,
          opacity: qrEl.opacity || 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockRotation: false,
        });
        break;
      }

      case 'table': {
        const tableEl = element as TableElement;
        const cells: any[] = [];

        let yOffset = 0;
        for (let row = 0; row < tableEl.rows; row++) {
          let xOffset = 0;
          for (let col = 0; col < tableEl.columns; col++) {
            const cellWidth = tableEl.columnWidths[col] || 60;
            const cellHeight = tableEl.rowHeights[row] || 50;

            const cell = new fabric.Rect({
              left: xOffset,
              top: yOffset,
              width: cellWidth,
              height: cellHeight,
              fill: 'transparent',
              stroke: tableEl.borderColor || '#ccc',
              strokeWidth: tableEl.borderWidth || 1,
            });
            cells.push(cell);
            xOffset += cellWidth;
          }
          yOffset += tableEl.rowHeights[row] || 50;
        }

        fabricObject = new fabric.Group(cells, {
          left: tableEl.x,
          top: tableEl.y,
          angle: tableEl.rotation || 0,
          opacity: tableEl.opacity || 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          lockScalingX: false,
          lockScalingY: false,
          lockRotation: false,
        });
        break;
      }
    }

    if (fabricObject) {
      (fabricObject as any).elementId = element.id;

      // Store in map
      fabricObjectsMap.current.set(element.id, fabricObject);

      // Check if this element should be positioned in a table cell
      if (element.type !== 'table') {
        const currentElements = useTemplateStore.getState().elements;
        const tables = currentElements.filter(el => el.type === 'table') as TableElement[];

        // Check if element belongs to a cell
        for (const table of tables) {
          const cellData = table.cells.find(c => c.elementId === element.id);
          if (cellData) {
            // Calculate cell offset using cumulative widths/heights
            const cellX = table.columnWidths.slice(0, cellData.column).reduce((sum, w) => sum + w, 0);
            const cellY = table.rowHeights.slice(0, cellData.row).reduce((sum, h) => sum + h, 0);

            // Use stored relative offset
            const offsetX = cellData.offsetX ?? 5;
            const offsetY = cellData.offsetY ?? 5;

            const canvasX = table.x + cellX + offsetX;
            const canvasY = table.y + cellY + offsetY;

            fabricObject.set({
              left: canvasX,
              top: canvasY,
            });
            break;
          }
        }
      }

      // Add to canvas (not to groups)
      canvas.add(fabricObject);

      // If element is in a table cell, bring it to front so it's selectable above the table
      if (element.type !== 'table') {
        const currentElements = useTemplateStore.getState().elements;
        const isInCell = currentElements.some(el =>
          el.type === 'table' && (el as TableElement).cells.some(c => c.elementId === element.id)
        );
        if (isInCell) {
          canvas.bringObjectToFront(fabricObject);
        }
      }
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-700 p-8">
      <div className="shadow-2xl rounded-sm" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
