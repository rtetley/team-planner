import { useState } from 'react';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
} from '@mui/material';
import { mockTeamMembers, mockTasks, mockTeamMatrix } from '../data/mockData';
import { MaturityLevel } from '../types';

export default function TeamMatrix() {
  const [matrixCells, setMatrixCells] = useState(mockTeamMatrix.cells);

  const getMaturityLevel = (teamMemberId: string, taskId: string): MaturityLevel | null => {
    const cell = matrixCells.find(
      (c) => c.teamMemberId === teamMemberId && c.taskId === taskId
    );
    return cell?.maturityLevel || null;
  };

  const handleMaturityChange = (
    teamMemberId: string,
    taskId: string,
    event: SelectChangeEvent<MaturityLevel | ''>
  ) => {
    const value = event.target.value as MaturityLevel | '';
    
    setMatrixCells((prev) => {
      const existingIndex = prev.findIndex(
        (c) => c.teamMemberId === teamMemberId && c.taskId === taskId
      );

      if (value === '') {
        // Remove cell if empty value selected
        return prev.filter((_, index) => index !== existingIndex);
      }

      if (existingIndex >= 0) {
        // Update existing cell
        const newCells = [...prev];
        newCells[existingIndex] = { teamMemberId, taskId, maturityLevel: value };
        return newCells;
      } else {
        // Add new cell
        return [...prev, { teamMemberId, taskId, maturityLevel: value }];
      }
    });
  };

  const maturityLevels: MaturityLevel[] = ['M1', 'M2', 'M3', 'M4'];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        Team Maturity Matrix
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="textSecondary">
          Assess team member maturity for each task/objective (M1 = Beginner, M4 = Expert)
        </Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>Team Member</TableCell>
              {mockTasks.map((task) => (
                <TableCell key={task.id} align="center" sx={{ fontWeight: 'bold', minWidth: 120 }}>
                  {task.title}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {mockTeamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell component="th" scope="row">
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {member.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {member.position}
                    </Typography>
                  </Box>
                </TableCell>
                {mockTasks.map((task) => (
                  <TableCell key={task.id} align="center">
                    <Select
                      value={getMaturityLevel(member.id, task.id) || ''}
                      onChange={(e) => handleMaturityChange(member.id, task.id, e)}
                      displayEmpty
                      size="small"
                      sx={{ minWidth: 80 }}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {maturityLevels.map((level) => (
                        <MenuItem key={level} value={level}>
                          {level}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
