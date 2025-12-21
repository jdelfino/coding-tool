'use client';

import { useState } from 'react';

interface ProblemDisplayProps {
  problemText: string;
  randomSeed?: number;
  attachedFiles?: Array<{ name: string; content: string }>;
  onRandomSeedChange?: (seed: number | undefined) => void;
  onAttachedFilesChange?: (files: Array<{ name: string; content: string }>) => void;
}

export default function ProblemDisplay({ 
  problemText, 
  randomSeed,
  attachedFiles = [],
  onRandomSeedChange,
  onAttachedFilesChange
}: ProblemDisplayProps) {
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
    if (!newFileName.trim()) return;
    
    const newFile = { name: newFileName.trim(), content: newFileContent };
    setLocalFiles([...localFiles, newFile]);
    setNewFileName('');
    setNewFileContent('');
  };

  const handleUpdateFile = (index: number, content: string) => {
    const updated = [...localFiles];
    updated[index] = { ...updated[index], content };
    setLocalFiles(updated);
  };

  const handleRemoveFile = (index: number) => {
    setLocalFiles(localFiles.filter((_, i) => i !== index));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!problemText) {
    return (
      <div style={{ 
        padding: '1rem', 
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        marginBottom: '1rem'
      }}>
        <p style={{ margin: 0, color: '#666' }}>
          Waiting for instructor to set a problem...
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '1rem', 
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      marginBottom: '1rem'
    }}>
      <h3 style={{ marginTop: 0 }}>Problem:</h3>
      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'sans-serif', marginBottom: '1rem' }}>
        {problemText}
      </div>

      {/* Random Seed Section */}
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #dee2e6' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Random Seed:</h4>
          {!editingSeed && (
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
        
        {editingSeed ? (
          <div>
            <input
              type="number"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="Enter seed (leave empty for none)"
              style={{
                width: '200px',
                padding: '0.5rem',
                fontSize: '0.9rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginBottom: '0.5rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSaveSeed}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                onClick={handleCancelSeedEdit}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: '#495057' }}>
            {randomSeed !== undefined ? randomSeed : <em>None (using default randomness)</em>}
          </div>
        )}
        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
          Controls Python's random module for reproducible results
        </div>
      </div>

      {/* Attached Files Section */}
      {(attachedFiles.length > 0 || editingFiles) && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #dee2e6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Available Files:</h4>
            {!editingFiles && (
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
                Edit Files
              </button>
            )}
          </div>

          {editingFiles ? (
            <div>
              {/* File list with editing */}
              {localFiles.map((file, index) => (
                <div key={index} style={{ 
                  marginBottom: '1rem',
                  padding: '0.5rem',
                  backgroundColor: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                      {file.name}
                    </span>
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
                  <textarea
                    value={file.content}
                    onChange={(e) => handleUpdateFile(index, e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '0.5rem',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              ))}

              {/* Add new file */}
              <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: 'white', border: '1px dashed #ccc', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Add New File:</div>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="filename.txt"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                  }}
                />
                <textarea
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="File content..."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                  }}
                />
                <button
                  onClick={handleAddFile}
                  disabled={!newFileName.trim()}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    backgroundColor: newFileName.trim() ? '#28a745' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: newFileName.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Add File
                </button>
              </div>

              {/* Save/Cancel buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  onClick={handleSaveFiles}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Save Files
                </button>
                <button
                  onClick={handleCancelFilesEdit}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {attachedFiles.map((file, index) => (
                <div key={index} style={{ 
                  marginBottom: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ 
                      fontWeight: 'bold', 
                      fontFamily: 'monospace', 
                      fontSize: '0.9rem',
                      backgroundColor: '#e9ecef',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '3px'
                    }}>
                      {file.name}
                    </span>
                    <button
                      onClick={() => copyToClipboard(file.name)}
                      title="Copy filename to clipboard"
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      📋 Copy Path
                    </button>
                  </div>
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: '#666',
                    fontFamily: 'monospace',
                    backgroundColor: '#f8f9fa',
                    padding: '0.5rem',
                    borderRadius: '3px',
                    maxHeight: '150px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}>
                    {file.content}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                    {(file.content.length / 1024).toFixed(2)} KB • Use: open('{file.name}', 'r')
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
