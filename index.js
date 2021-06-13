import React, { useReducer, useRef, useEffect, useState } from 'react';

import StackLayout from '@bench-redesign/components/components/layout/StackLayout';
import Button from '@bench-redesign/components/components/Button';
import VisuallyHidden from '@mc/components/VisuallyHidden';
import StepHeading from '../components/StepHeading';
import ListImportShell from '../ListImportShell';
import stylesheet from './CopyPaste.less';
import {
  useWizardActions,
  useWizardInventory,
} from '../../../components/Wizard';
import { createContactImport } from '../resourceMocks';

const createNewTable = (y, x) =>
  Array(y)
    .fill(null)
    .map(() =>
      Array(x)
        .fill(null)
        .map(() => '')
    );

const fillNewTable = (newTable, oldTable) => {
  oldTable.forEach((oldRow, y) => {
    oldRow.forEach((oldCell, x) => {
      newTable[y][x] = oldCell;
    });
  });
  return newTable;
};

// state = current state
// action = { type: actionName, selectedCell: [y, x], value: '', event: event, offsetY : 0, offsetX: 0 }
const reducer = (state, action) => {
  switch (action.type) {
    case 'ENTER_KEY_ON_BUTTON':
    case 'DOUBLE_CLICK_ON_BUTTON':
      return {
        ...state,
        editing: true,
        selectedCell: action.selectedCell,
        canNavigateWithArrowKeys: false,
      };

    case 'ESC_ON_INPUT':
      return {
        ...state,
        editing: false,
        table: state.table.map((row, y) => {
          return row.map((cell, x) => {
            if (y === action.selectedCell[0] && x === action.selectedCell[1]) {
              return action.previousCellValue;
            }
            return cell;
          });
        }),
      };
    case 'EDIT_TEXT':
      return {
        ...state,
        editing: true,
        selectedCell: action.selectedCell,
        canNavigateWithArrowKeys: action.canNavigateWithArrowKeys,
        table: state.table.map((row, y) => {
          return row.map((cell, x) => {
            if (y === action.selectedCell[0] && x === action.selectedCell[1]) {
              return action.value;
            }
            return cell;
          });
        }),
        previousCellValue: action.previousCellValue,
      };
    case 'CREATE_NEW_TABLE': {
      const newTable = createNewTable(
        state.table.length + action.offsetY - 1,
        state.table[0].length + action.offsetX
      );
      fillNewTable(newTable, state.table);
      return {
        ...state,
        table: newTable,
      };
    }
    case 'PASTE_DATA': {
      const handlePaste = (data) => {
        const pastedRows = data.split('\n');
        const pastedTable = pastedRows.map((row) => row.split('	'));
        let newTable = state.table;
        let newNumberofRows = state.table.length;
        let newNumberofCols = state.table[0].length;
        // if copied data has more rows than our table
        if (pastedTable.length + action.selectedCell[0] > state.table.length) {
          newNumberofRows = pastedTable.length + action.selectedCell[0];
        }
        // if copied data has more cols than our table
        if (
          pastedTable[0].length + action.selectedCell[1] >
          state.table[0].length
        ) {
          newNumberofCols = pastedTable[0].length + action.selectedCell[1];
        }

        // create new table
        newTable = createNewTable(newNumberofRows, newNumberofCols);
        // fill newTable with old data
        fillNewTable(newTable, state.table);
        const newTableCopy = JSON.parse(JSON.stringify(newTable));
        // then paste
        pastedTable.forEach((row, y) => {
          row.forEach((cell, x) => {
            newTableCopy[y + action.selectedCell[0]][
              x + action.selectedCell[1]
            ] = cell;
          });
        });
        return newTableCopy;
      };
      return {
        ...state,
        editing: false,
        selectedCell: action.selectedCell,
        table: handlePaste(action.value),
      };
    }
    case 'CHANGE_SELECTED_CELLS': {
      return {
        ...state,
        editing: false,
        selectedCell: [action.selectedCell[0], action.selectedCell[1]],
      };
    }
    case 'TYPE_ON_BUTTON': {
      return {
        ...state,
        editing: true,
      };
    }
    default:
      return state;
  }
};
// this variable is to handle multi key press
const keyPressed = {};
// TODO: pass state or have state accessible from the component
function EditableCell({
  isEditing,
  selectedCell,
  canNavigateWithArrowKeys,
  cellValue,
  x,
  y,
  dispatch,
  handleButtonKeyDown,
  handleInputKeyDown,
  handleDoubleClick,
  previousCellValue,
}) {
  React.useEffect(() => {
    const handler = (e) => {
      dispatch({
        type: 'PASTE_DATA',
        selectedCell: [y, x],
        value: e.clipboardData.getData('Text'),
      });
    };

    if (selectedCell[0] === y && selectedCell[1] === x) {
      document.addEventListener('paste', handler);
      return () => {
        document.removeEventListener('paste', handler);
      };
    }
  }, [selectedCell, dispatch, y, x]);

  return !(isEditing && selectedCell[0] === y && selectedCell[1] === x) ? (
    <button
      type="button"
      // tabIndex={x === 0 && y === 0 ? undefined : -1}
      onDoubleClick={() => handleDoubleClick(y, x)}
      onKeyDown={(e) => {
        keyPressed[e.key] = true;
        handleButtonKeyDown(e, y, x);
      }}
      onFocus={() => {
        dispatch({ type: 'CHANGE_SELECTED_CELLS', selectedCell: [y, x] });
      }}
    >
      <VisuallyHidden>Edit Cell</VisuallyHidden>
      {cellValue === '' ? String.fromCharCode(160) : cellValue}
    </button>
  ) : (
    <input
      autoFocus
      type="text"
      value={cellValue}
      onDoubleClick={() => handleDoubleClick(y, x)}
      onChange={(e) => {
        dispatch({
          type: 'EDIT_TEXT',
          selectedCell: [y, x],
          value: e.target.value,
          canNavigateWithArrowKeys,
          event: e,
          previousCellValue: previousCellValue,
        });
      }}
      onKeyDown={(e) => handleInputKeyDown(e, y, x)}
      onBlur={() =>
        dispatch({ type: 'CHANGE_SELECTED_CELLS', selectedCell: [y, x] })
      }
    />
  );
}

export const CopyPaste = () => {
  const inventory = useWizardInventory();
  const wizardActions = useWizardActions();
  const initialState = {
    editing: false,
    selectedCell: [0, 0],
    table: inventory.table || createNewTable(10, 5),
    canNavigateWithArrowKeys: true,
    previousCellValue: '',
  };
  const [state, dispatch] = useReducer(reducer, initialState);
  const tableRef = useRef();
  const [isLoading, setIsLoading] = useState(false);

  const expandTable = (y, x, offsetY, offsetX) => {
    // check if there's content in last cell first
    if (state.table[y][x] !== '') {
      // if we are moving down or right of table limit, create a new table
      if (
        y + offsetY > state.table.length ||
        x + offsetX + 1 > state.table[0].length
      ) {
        dispatch({ type: 'CREATE_NEW_TABLE', offsetY, offsetX });
      }
    }
  };

  useEffect(() => {
    // TODO: after click selectedCell becomes null?
    if (state.selectedCell === null) {
      return;
    }

    const [selectedY, selectedX] = state.selectedCell;

    let el;
    if (selectedY === 0) {
      // selectedY + 1: nth-child is 1-indexed, so we need to increment by 1
      // selectedX + 1 + 1: nth-of-type is 1-indexed, and the first th is empty
      el = tableRef.current.querySelector(
        `thead tr:nth-child(${selectedY + 1}) th:nth-of-type(${
          selectedX + 1 + 1
        })`
      );
    } else {
      // selectedY + 1 - 1: nth-child is 1-indexed, but we need to offset by 1 row (no more header)
      // selectedX + 1: nth-of-type is 1-indexed, and the first column is a th.
      el = tableRef.current.querySelector(
        `tbody tr:nth-child(${selectedY + 1 - 1}) td:nth-of-type(${
          selectedX + 1
        })`
      );
    }
    if (el) {
      el.firstElementChild.focus();
    }
  }, [state]);

  const handleDoubleClick = (y, x) => {
    dispatch({ type: 'DOUBLE_CLICK_ON_BUTTON', selectedCell: [y, x] });
  };

  const handleInputKeyDown = (e, y, x) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      expandTable(y, x, 2, 0);
      // change selectedCells which then trigger useEffect
      dispatch({ type: 'CHANGE_SELECTED_CELLS', selectedCell: [y + 1, x] });
    }

    if (state.canNavigateWithArrowKeys) {
      if (e.key === 'ArrowLeft') {
        if (state.selectedCell[1] === 0) {
          return;
        }
        e.preventDefault();
        dispatch({
          type: 'CHANGE_SELECTED_CELLS',
          selectedCell: [y, x - 1],
        });
      } else if (e.key === 'ArrowUp') {
        if (state.selectedCell[0] === 0) {
          return;
        }
        e.preventDefault();
        dispatch({
          type: 'CHANGE_SELECTED_CELLS',
          selectedCell: [y - 1, x],
        });
      } else if (e.key === 'ArrowRight') {
        // if we reach the limit end of the table and no content in the last cell, focus should stay in current cell
        if (
          state.selectedCell[1] === state.table[0].length - 1 &&
          state.table[state.selectedCell[0]][state.selectedCell[1]] === ''
        ) {
          return;
        }
        e.preventDefault();
        expandTable(y, x, 1, 1);
        dispatch({
          type: 'CHANGE_SELECTED_CELLS',
          selectedCell: [y, x + 1],
        });
      } else if (e.key === 'ArrowDown') {
        // if we reach the limit end of the table and no content in the last cell, focus should stay in current cell
        if (
          state.selectedCell[0] === state.table.length - 1 &&
          state.table[state.selectedCell[0]][state.selectedCell[1]] === ''
        ) {
          return;
        }
        e.preventDefault();
        expandTable(y, x, 2, 0);
        dispatch({
          type: 'CHANGE_SELECTED_CELLS',
          selectedCell: [y + 1, x],
        });
      }
    }

    if (e.key === 'Escape' || e.key === 'Esc') {
      dispatch({
        type: 'ESC_ON_INPUT',
        selectedCell: [y, x],
        previousCellValue: state.previousCellValue,
      });
    }
  };

  const handleButtonKeyDown = (e, y, x) => {
    if (e.key.length === 1) {
      dispatch({
        type: 'TYPE_ON_BUTTON',
      });
    }
    if (e.key === 'Enter') {
      // Prevent the click event from firing
      e.preventDefault();
      expandTable(y, x, 2, 0);
      dispatch({ type: 'ENTER_KEY_ON_BUTTON', selectedCell: [y, x] });
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      dispatch({ type: 'EDIT_TEXT', selectedCell: [y, x], value: '' });
    }

    if (e.key === 'ArrowLeft') {
      if (state.selectedCell[1] === 0) {
        return;
      }
      e.preventDefault();
      dispatch({
        type: 'CHANGE_SELECTED_CELLS',
        selectedCell: [y, x - 1],
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      dispatch({
        type: 'CHANGE_SELECTED_CELLS',
        selectedCell: [y - 1, x],
      });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      dispatch({
        type: 'CHANGE_SELECTED_CELLS',
        selectedCell: [y, x + 1],
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      expandTable(y, x, 2, 0);
      dispatch({
        type: 'CHANGE_SELECTED_CELLS',
        selectedCell: [y + 1, x],
      });
    } else if (/^[a-z0-9]{1}$/i.test(e.key)) {
      dispatch({
        type: 'EDIT_TEXT',
        value: e.target.value,
        selectedCell: [y, x],
        canNavigateWithArrowKeys: true,
        previousCellValue: state.table[y][x],
      });
      // TODO: need to copy paste the 4 logic belows to input. Probably better fo abstract the
      // logic to use for both input and button
      // adding Home and End command to allow for skipping table for keyboard user
    } else if (e.key === 'Home') {
      dispatch({
        type: 'CHANGE_SELECTED_CELLS',
        selectedCell: [0, 0],
      });
      // End will go to the last cell of the current row
    } else if (e.key === 'End') {
      dispatch({
        type: 'CHANGE_SELECTED_CELLS',
        selectedCell: [state.selectedCell[0], state.table[0].length - 1],
      });
    }
    // cmd + end go to last cell on bottom right of table
    if (keyPressed.Meta && e.key === 'End') {
      dispatch({
        type: 'CHANGE_SELECTED_CELLS',
        selectedCell: [state.table.length - 1, state.table[0].length - 1],
      });
    }
    document.addEventListener('keyup', (event) => {
      delete keyPressed[event.key];
    });

    // TODO: cmd + home go to first cell
  };
  const {
    table,
    editing,
    selectedCell,
    canNavigateWithArrowKeys,
    previousCellValue,
  } = state;

  return (
    <ListImportShell>
      <StackLayout gap="s">
        <StepHeading
          title="Copy and paste your contacts"
          subtitle="Step 2 of 4: Copy/paste"
        />

        <table role="grid" ref={tableRef} className={stylesheet.root}>
          <thead>
            <tr>
              {/* extra th to offset one cell to the right */}
              <th></th>
              {table[0].map((cellValue, index) => (
                <th key={index} scope="col">
                  <EditableCell
                    isEditing={editing}
                    selectedCell={selectedCell}
                    canNavigateWithArrowKeys={canNavigateWithArrowKeys}
                    cellValue={cellValue}
                    x={index}
                    y={0}
                    handleButtonKeyDown={handleButtonKeyDown}
                    handleInputKeyDown={handleInputKeyDown}
                    dispatch={dispatch}
                    handleDoubleClick={handleDoubleClick}
                    previousCellValue={previousCellValue}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.slice(1).map((row, index) => {
              const y = index + 1;
              return (
                <tr key={y}>
                  {/* Row headers */}
                  <th scope="row">{y}</th>

                  {/* Table items */}
                  {row.map((cellValue, x) => {
                    return (
                      <td key={x}>
                        <EditableCell
                          isEditing={editing}
                          selectedCell={selectedCell}
                          canNavigateWithArrowKeys={canNavigateWithArrowKeys}
                          cellValue={cellValue}
                          x={x}
                          y={y}
                          handleButtonKeyDown={handleButtonKeyDown}
                          handleInputKeyDown={handleInputKeyDown}
                          dispatch={dispatch}
                          handleDoubleClick={handleDoubleClick}
                          previousCellValue={previousCellValue}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div>
          <Button
            type="primary"
            isLoading={isLoading}
            // disabled when table is blank
            disabled={
              isLoading ||
              table.every((row) => row.every((cell) => cell === ''))
            }
            onClick={() => {
              setIsLoading(true);
              createContactImport()
                .then((response) => {
                  setIsLoading(false);
                  wizardActions.setInventory((items) => ({
                    ...items,
                    table,
                    importRecord: response,
                  }));
                  wizardActions.navigate('organize');
                })
                .catch((error) => {
                  setIsLoading(false);
                  throw error;
                });
            }}
          >
            Continue to Organize
          </Button>
        </div>
      </StackLayout>
    </ListImportShell>
  );
};

export default CopyPaste;
