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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { mockTeamMembers, mockTasks, mockTeamMatrix } from '../data/mockData';
import { MaturityLevel } from '../types';
import { useTranslation } from 'react-i18next';

export default function TeamMatrix() {
  const { t } = useTranslation();
  const [matrixCells, setMatrixCells] = useState(mockTeamMatrix.cells);
  const [modalOpen, setModalOpen] = useState(false);

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h3">
          {t('matrix.title')}
        </Typography>
        <IconButton 
          color="primary" 
          onClick={() => setModalOpen(true)}
          aria-label="info"
          size="large"
        >
          <InfoIcon />
        </IconButton>
      </Box>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="textSecondary">
          {t('matrix.description')}
        </Typography>
      </Box>

      <Dialog 
        open={modalOpen} 
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>{t('matrix.modalTitle')}</DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Skill/Will Graph */}
            <Box 
              sx={{ 
                position: 'relative',
                width: 'calc(100% - 100px)',
                height: 280,
                border: '2px solid #000',
                mb: 2,
                ml: 10
              }}
            >
              {/* Grid lines */}
              <Box sx={{ 
                position: 'absolute', 
                left: '50%', 
                top: 0, 
                bottom: 0, 
                width: '1px', 
                bgcolor: '#ccc' 
              }} />
              <Box sx={{ 
                position: 'absolute', 
                top: '50%', 
                left: 0, 
                right: 0, 
                height: '1px', 
                bgcolor: '#ccc' 
              }} />
              
              {/* Quadrants */}
              {/* M1 - Bottom Left */}
              <Box sx={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                width: '50%',
                height: '50%',
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #ef4444'
              }}>
                <Typography variant="h6" color="#ef4444" fontWeight="bold">
                  M1
                </Typography>
              </Box>
              
              {/* M2 - Top Left */}
              <Box sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '50%',
                height: '50%',
                bgcolor: 'rgba(249, 115, 22, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #f97316'
              }}>
                <Typography variant="h6" color="#f97316" fontWeight="bold">
                  M2
                </Typography>
              </Box>
              
              {/* M3 - Bottom Right */}
              <Box sx={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: '50%',
                height: '50%',
                bgcolor: 'rgba(234, 179, 8, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #eab308'
              }}>
                <Typography variant="h6" color="#eab308" fontWeight="bold">
                  M3
                </Typography>
              </Box>
              
              {/* M4 - Top Right */}
              <Box sx={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '50%',
                height: '50%',
                bgcolor: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #22c55e'
              }}>
                <Typography variant="h6" color="#22c55e" fontWeight="bold">
                  M4
                </Typography>
              </Box>
              
              {/* Axis Labels */}
              <Typography 
                sx={{ 
                  position: 'absolute', 
                  bottom: -28, 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}
              >
                {t('matrix.skill')} →
              </Typography>
              <Typography 
                sx={{ 
                  position: 'absolute', 
                  left: -88, 
                  top: '50%', 
                  transform: 'translateY(-50%) rotate(-90deg)',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  width: 100,
                  textAlign: 'center',
                  fontSize: '0.9rem'
                }}
              >
                {t('matrix.will')} →
              </Typography>
              
              {/* Low/High labels */}
              <Typography variant="caption" sx={{ position: 'absolute', left: 5, bottom: 5, fontSize: '0.7rem' }}>
                {t('matrix.low')}
              </Typography>
              <Typography variant="caption" sx={{ position: 'absolute', right: 5, top: 5, fontSize: '0.7rem' }}>
                {t('matrix.high')}
              </Typography>
            </Box>

            {/* Explanation */}
            <Typography variant="body2" paragraph sx={{ mb: 1.5, mt: 2, textAlign: 'center', px: 2 }}>
              {t('matrix.modalExplanation')}
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', px: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="#ef4444" fontWeight="bold" sx={{ fontSize: '0.85rem' }}>
                  {t('matrix.m1Label')}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {t('matrix.m1Description')}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="#f97316" fontWeight="bold" sx={{ fontSize: '0.85rem' }}>
                  {t('matrix.m2Label')}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {t('matrix.m2Description')}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="#eab308" fontWeight="bold" sx={{ fontSize: '0.85rem' }}>
                  {t('matrix.m3Label')}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {t('matrix.m3Description')}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" color="#22c55e" fontWeight="bold" sx={{ fontSize: '0.85rem' }}>
                  {t('matrix.m4Label')}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {t('matrix.m4Description')}
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ pt: 1 }}>
          <Button onClick={() => setModalOpen(false)} color="primary">
            {t('matrix.close')}
          </Button>
        </DialogActions>
      </Dialog>

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
