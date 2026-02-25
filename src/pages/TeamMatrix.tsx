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
import { useTranslation } from 'react-i18next';

export default function TeamMatrix() {
  const { t } = useTranslation();
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

  const getMaturityColor = (level: MaturityLevel | null): string => {
    if (!level) return 'transparent';
    
    const colors = {
      M1: '#ef4444', // Red
      M2: '#f97316', // Orange
      M3: '#eab308', // Yellow
      M4: '#22c55e', // Green
    };
    
    return colors[level];
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        {t('matrix.title')}
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="textSecondary">
          {t('matrix.description')}
        </Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', minWidth: 150 }}>{t('matrix.teamMember')}</TableCell>
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
                  <TableCell 
                    key={task.id} 
                    align="center"
                    sx={{ 
                      backgroundColor: getMaturityColor(getMaturityLevel(member.id, task.id)),
                      transition: 'background-color 0.3s ease'
                    }}
                  >
                    <Select
                      value={getMaturityLevel(member.id, task.id) || ''}
                      onChange={(e) => handleMaturityChange(member.id, task.id, e)}
                      displayEmpty
                      size="small"
                      sx={{ 
                        minWidth: 80,
                        '& .MuiSelect-select': {
                          color: getMaturityLevel(member.id, task.id) ? '#fff' : 'inherit',
                          fontWeight: 'bold'
                        }
                      }}
                    >
                      <MenuItem value="">
                        <em>{t('matrix.none')}</em>
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
