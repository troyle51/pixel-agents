import { useState } from 'react';

import { isSoundEnabled, setSoundEnabled } from '../notificationSound.js';
import { vscode } from '../vscodeApi.js';
import { Button } from './ui/Button.js';
import { Checkbox } from './ui/Checkbox.js';
import { MenuItem } from './ui/MenuItem.js';
import { Modal } from './ui/Modal.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDebugMode: boolean;
  onToggleDebugMode: () => void;
  alwaysShowOverlay: boolean;
  onToggleAlwaysShowOverlay: () => void;
  externalAssetDirectories: string[];
  watchAllSessions: boolean;
  onToggleWatchAllSessions: () => void;
  hooksEnabled: boolean;
  onToggleHooksEnabled: () => void;
  pinnedPets: string[];
  availablePets: string[];
  onSetPinnedPets: (pets: string[]) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  isDebugMode,
  onToggleDebugMode,
  alwaysShowOverlay,
  onToggleAlwaysShowOverlay,
  externalAssetDirectories,
  watchAllSessions,
  onToggleWatchAllSessions,
  hooksEnabled,
  onToggleHooksEnabled,
  pinnedPets,
  availablePets,
  onSetPinnedPets,
}: SettingsModalProps) {
  const [soundLocal, setSoundLocal] = useState(isSoundEnabled);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <MenuItem
        onClick={() => {
          vscode.postMessage({ type: 'openSessionsFolder' });
          onClose();
        }}
      >
        Open Sessions Folder
      </MenuItem>
      <MenuItem
        onClick={() => {
          vscode.postMessage({ type: 'exportLayout' });
          onClose();
        }}
      >
        Export Layout
      </MenuItem>
      <MenuItem
        onClick={() => {
          vscode.postMessage({ type: 'importLayout' });
          onClose();
        }}
      >
        Import Layout
      </MenuItem>
      <MenuItem
        onClick={() => {
          vscode.postMessage({ type: 'addExternalAssetDirectory' });
          onClose();
        }}
      >
        Add Asset Directory
      </MenuItem>
      {externalAssetDirectories.map((dir) => (
        <div key={dir} className="flex items-center justify-between py-4 px-10 gap-8">
          <span
            className="text-xs text-text-muted overflow-hidden text-ellipsis whitespace-nowrap"
            title={dir}
          >
            {dir.split(/[/\\]/).pop() ?? dir}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => vscode.postMessage({ type: 'removeExternalAssetDirectory', path: dir })}
            className="shrink-0"
          >
            x
          </Button>
        </div>
      ))}
      {/* Pinned Pets */}
      <div
        style={{
          padding: '8px 10px 4px',
          fontSize: 10,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Pinned Pets
      </div>
      {pinnedPets.map((species) => (
        <div key={species} className="flex items-center justify-between py-4 px-10 gap-8">
          <span className="text-xs text-text">
            {species.charAt(0).toUpperCase() + species.slice(1)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSetPinnedPets(pinnedPets.filter((p) => p !== species))}
            className="shrink-0"
          >
            x
          </Button>
        </div>
      ))}
      {pinnedPets.length < 6 && (
        <div style={{ padding: '2px 10px 8px' }}>
          <select
            style={{
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              padding: '3px 6px',
              fontSize: 11,
              width: '100%',
            }}
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              if (val && !pinnedPets.includes(val)) {
                onSetPinnedPets([...pinnedPets, val]);
              }
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              Add a pet…
            </option>
            {availablePets
              .filter((p) => !pinnedPets.includes(p))
              .map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
          </select>
        </div>
      )}
      <Checkbox
        label="Sound Notifications"
        checked={soundLocal}
        onChange={() => {
          const newVal = !isSoundEnabled();
          setSoundEnabled(newVal);
          setSoundLocal(newVal);
          vscode.postMessage({ type: 'setSoundEnabled', enabled: newVal });
        }}
      />
      <Checkbox
        label="Watch All Sessions"
        checked={watchAllSessions}
        onChange={onToggleWatchAllSessions}
      />
      <Checkbox
        label="Instant Detection (Hooks)"
        checked={hooksEnabled}
        onChange={onToggleHooksEnabled}
      />
      <Checkbox
        label="Always Show Labels"
        checked={alwaysShowOverlay}
        onChange={onToggleAlwaysShowOverlay}
      />
      <Checkbox label="Debug View" checked={isDebugMode} onChange={onToggleDebugMode} />
    </Modal>
  );
}
