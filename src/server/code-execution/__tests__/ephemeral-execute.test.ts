/**
 * Tests for ephemeral code execution utility
 *
 * The executeEphemeral function runs code without associating it with a
 * session, delegating to the executor service (local nsjail backend).
 */

import { CodeSubmission, ExecutionResult } from '../interfaces';

// Mock the executor service
jest.mock('../executor-service', () => ({
  getExecutorService: jest.fn(),
}));

import { executeEphemeral } from '../ephemeral-execute';
import { getExecutorService } from '../executor-service';

const mockGetExecutorService = getExecutorService as jest.MockedFunction<typeof getExecutorService>;

describe('executeEphemeral', () => {
  const mockExecuteCode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetExecutorService.mockReturnValue({
      executeCode: mockExecuteCode,
    } as unknown as ReturnType<typeof getExecutorService>);
  });

  it('should execute code using executor service without sessionId', async () => {
    const submission: CodeSubmission = {
      code: 'print("hello")',
      executionSettings: { stdin: 'test input' },
    };

    const expectedResult: ExecutionResult = {
      success: true,
      output: 'hello\n',
      error: '',
      executionTime: 100,
    };

    mockExecuteCode.mockResolvedValue(expectedResult);

    const result = await executeEphemeral(submission);

    expect(result).toEqual(expectedResult);
    expect(mockExecuteCode).toHaveBeenCalledWith(submission, undefined);
    // Verify sessionId is NOT passed (ephemeral execution)
    expect(mockExecuteCode).toHaveBeenCalledTimes(1);
  });

  it('should pass timeout to executor service', async () => {
    const submission: CodeSubmission = { code: 'x = 1' };
    const timeout = 5000;

    mockExecuteCode.mockResolvedValue({
      success: true,
      output: '',
      error: '',
      executionTime: 50,
    });

    await executeEphemeral(submission, timeout);

    expect(mockExecuteCode).toHaveBeenCalledWith(submission, timeout);
  });

  it('should propagate execution errors', async () => {
    const submission: CodeSubmission = { code: 'print(' };

    mockExecuteCode.mockRejectedValue(new Error('Syntax error'));

    await expect(executeEphemeral(submission)).rejects.toThrow('Syntax error');
  });
});
