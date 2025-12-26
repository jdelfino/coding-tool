'use client';

import React, { useState } from 'react';

interface ExecutionSettingsProps {
  stdin?: string;
  onStdinChange?: (stdin: string) => void;
  randomSeed?: number;
  onRandomSeedChange?: (seed: number | undefined) => void;
  attachedFiles?: Array<{ name: string; content: string }>;
  onAttachedFilesChange?: (files: Array<{ name: string; content: string }>) => void;
  exampleInput?: string;
  readOnly?: boolean;
}

export default function ExecutionSettings({
  stdin = '',
  onStdinChange,
  randomSeed,
  onRandomSeedChange,
  attachedFiles = [],
  onAttachedFilesChange,
  exampleInput,
  readOnly = false
}: ExecutionSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingSeed, setEditingSeed] = useState(false);
  const [seedInput, setSeedInput] = useState(randomSeed?.toString() || '');
  const [editingFiles, setEditingFiles] = useState(false);
  const [localFiles, setLocalFiles] = useState(attachedFiles);
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  const handleSaveSeed = () => {
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    if (onRandomSeedChange) {
      onRandomSeedChange(seed);
    }
    setEditingSeed(false);
  };

  const handleCancelSeedEdit = () => {
    setSeedInput(randomSeed?.toString() || '');
    setEditingSeed(false);
  };

  const handleSaveFiles = () => {
    if (onAttachedFilesChange) {
      onAttachedFilesChange(localFiles);
    }
    setEditingFiles(false);
  };

  const handleCancelFilesEdit = () => {
    setLocalFiles(attachedFiles);
    setNewFileName('');
    setNewFileContent('');
    setEditingFiles(false);
  };

  const handleAddFile = () => {
    if (newFileName.trim() && newFileContent.trim()) {
      setLocalFiles([...localFiles, { name: newFileName.trim(), content: newFileContent }]);
      setNewFileName('');
      setNewFileContent('');
    }
  };

  const handleRemoveFile = (index: number) => {
    setLocalFiles(localFiles.filter((_, i) => i !== index));
  };

  const handleEditFile = (index: number) => {
    const file = localFiles[index];
    setNewFileName(file.name);
    setNewFileContent(file.content);
    handleRemoveFile(index);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const hasContent = stdin || randomSeed !== undefined || attachedFiles.length > 0;

  return (
    <div style={{
      borderTop: '1px solid #ccc',
      backgroundColor: '#f5f5f5',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '0.5rem 1rem',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ 
            transition: 'transform 0.2s',
            display: 'inline-block',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>
            ▶
          </span>
          Execution Settings
        </div>
        {hasContent && !expanded && (
          <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 'normal' }}>
            {stdin && '📝'} {randomSeed !== undefined && '🎲'} {attachedFiles.length > 0 && `📁 ${attachedFiles.length}`}
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: 'white',
          borderTop: '1px solid #ccc'
        }}>
          {/* Program Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}>
              Program Input (stdin):
              {exampleInput && (
                <span style={{ 
                  marginLeft: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#666',
                  fontWeight: 'normal'
                }}>
                  (example provided by instructor)
                </span>
              )}
            </label>
            <textarea
              value={stdin}
              onChange={(e) => onStdinChange?.(e.target.value)}
              placeholder="Enter input for your program (one value per line)"
              readOnly={readOnly}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                resize: 'vertical',
                backgroundColor: readOnly ? '#f5f5f5' : 'white',
              }}
            />
          </div>

          {/* Random Seed */}
          <div style={{ marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>Random Seed:</h4>
              {!readOnly && !editingSeed && (
                <button
                  onClick={() => {
                    setSeedInput(randomSeed?.toString() || '');
                    setEditingSeed(true);
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              )}
            </div>

            {!editingSeed ? (
              <div style={{ 
                padding: '0.5rem', 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}>
                {randomSeed !== undefined ? (
                  <code>{randomSeed}</code>
                ) : (
                  <span style={{ color: '#666', fontStyle: 'italic' }}>No seed set (random)</span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="Enter seed (leave empty for random)"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}
                />
                <button
                  onClick={handleSaveSeed}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={handleCancelSeedEdit}
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
              Makes random numbers predictable. Same seed = same "random" results.
            </p>
          </div>

          {/* Attached Files */}
          <div style={{ paddingTop: '1rem', borderTop: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>Attached Files:</h4>
              {!readOnly && !editingFiles && (
                <button
                  onClick={() => {
                    setLocalFiles(attachedFiles);
                    setEditingFiles(true);
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.8rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              )}
            </div>

            {!editingFiles ? (
              <>
                {attachedFiles.length === 0 ? (
                  <div style={{ 
                    padding: '0.5rem', 
                    backgroundColor: '#f8f9fa', 
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}>
                    <span style={{ color: '#666', fontStyle: 'italic' }}>No files attached</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {attachedFiles.map((file, index) => (
                      <div 
                        key={index}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong style={{ fontSize: '0.9rem' }}>{file.name}</strong>
                            <button
                              onClick={() => copyToClipboard(file.name)}
                              title="Copy file path"
                              style={{
                                padding: '0.2rem 0.4rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                              }}
                            >
                              📋 Copy Path
                            </button>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: '#666' }}>
                            {file.content.length} bytes
                          </span>
                        </div>
                        <pre style={{
                          margin: 0,
                          padding: '0.5rem',
                          backgroundColor: 'white',
                          border: '1px solid #dee2e6',
                          borderRadius: '3px',
                          fontSize: '0.85rem',
                          maxHeight: '150px',
                          overflow: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}>
                          {file.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Existing files list */}
                {localFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {localFiles.map((file, index) => (
                      <div 
                        key={index}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#e9ecef',
                          border: '1px solid #dee2e6',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>{file.name}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleEditFile(index)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8rem',
                              backgroundColor: '#0070f3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8rem',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new file form */}
                <div style={{ 
                  padding: '0.75rem', 
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Add File:</h5>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="Filename (e.g., data.txt)"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      marginBottom: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '0.9rem'
                    }}
                  />
                  <textarea
                    value={newFileContent}
                    onChange={(e) => setNewFileContent(e.target.value)}
                    placeholder="File content"
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                    }}
                  />
                  <button
                    onClick={handleAddFile}
                    disabled={!newFileName.trim() || !newFileContent.trim()}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: newFileName.trim() && newFileContent.trim() ? '#28a745' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: newFileName.trim() && newFileContent.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '0.85rem'
                    }}
                  >
                    Add File
                  </button>
                </div>

                {/* Save/Cancel buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleSaveFiles}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancelFilesEdit}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#666' }}>
              Files your code can read from. Use the filename to open (e.g., <code>open("data.txt")</code>).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
