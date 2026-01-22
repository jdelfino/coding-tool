'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

interface Student {
  id: string;
  name: string;
  hasCode: boolean;
}

interface StudentListProps {
  students: Student[];
  onSelectStudent: (studentId: string) => void;
  onShowOnPublicView?: (studentId: string) => void;
  onViewHistory?: (studentId: string, studentName: string) => void;
  joinCode?: string;
  isLoading?: boolean;
}

export default function StudentList({ students, onSelectStudent, onShowOnPublicView, onViewHistory, joinCode, isLoading = false }: StudentListProps) {
  return (
    <Card variant="outlined" className="p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Connected Students ({students.length})</h3>
      {isLoading ? (
        <div className="text-gray-500 py-4">
          <p className="m-0">Loading students...</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-gray-50 p-4 rounded mt-2">
          <p className="text-gray-500 mb-2">
            Waiting for students to join the session.
          </p>
          {joinCode && (
            <p className="text-gray-700 m-0">
              Share this join code with your students:{' '}
              <span className="font-mono font-bold bg-gray-200 px-2 py-1 rounded text-blue-600">
                {joinCode}
              </span>
            </p>
          )}
          {!joinCode && (
            <p className="text-gray-400 text-sm m-0">
              Students can join using the session join code displayed in the session controls.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((student) => (
            <div
              key={student.id}
              className={`p-3 border border-gray-200 rounded flex justify-between items-center ${
                student.hasCode ? 'bg-blue-50' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">{student.name}</span>
                <Badge variant={student.hasCode ? 'success' : 'default'}>
                  {student.hasCode ? 'Has code' : 'No code yet'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSelectStudent(student.id)}
                  className="from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700"
                >
                  View Code
                </Button>
                {onViewHistory && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onViewHistory(student.id, student.name)}
                    title="View code revision history"
                    className="from-purple-600 to-purple-600 hover:from-purple-700 hover:to-purple-700"
                  >
                    View History
                  </Button>
                )}
                {onShowOnPublicView && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onShowOnPublicView(student.id)}
                    title="Display this submission on the public view"
                    className="from-emerald-500 to-emerald-500 hover:from-emerald-600 hover:to-emerald-600"
                  >
                    Show on Public View
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
