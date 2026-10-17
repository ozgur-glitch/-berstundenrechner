import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Modal,
  Platform,
  Share
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe Native Module Loading mit Try-Catch Fallbacks
let FileSystem = null;
let DocumentPicker = null;
let Notifications = null;

try {
  FileSystem = require('expo-file-system');
} catch (e) {
  console.log('FileSystem module fallback');
}

try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.log('DocumentPicker module fallback');
}

try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('Notifications module fallback');
}

const STORAGE_KEY_HISTORY = '@uberstunden_history_v1';
const STORAGE_KEY_SETTINGS = '@uberstunden_settings_v1';

export default function App() {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [aircraftType, setAircraftType] = useState('B747_A340'); // 'B747_A340' oder 'ALL_OTHERS'
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  
  // Backup Modal State
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [backupJsonText, setBackupJsonText] = useState('');
  const [isExporting, setIsExporting] = useState(true);

  const endTimeInputRef = useRef(null);

  // Initiales Laden der gespeicherten Daten
  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
      const savedSettings = await AsyncStorage.getItem(STORAGE_KEY_SETTINGS);

      if (savedHistory) setHistory(JSON.parse(savedHistory));
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        if (parsedSettings.aircraftType) setAircraftType(parsedSettings.aircraftType);
      }
    } catch (e) {
      console.error('Fehler beim Laden der Daten:', e);
    }
  };

  const saveHistoryToStorage = async (newHistory) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
    } catch (e) {
      console.error('Fehler beim Speichern der Historie:', e);
    }
  };

  const handleAircraftChange = async (type) => {
    setAircraftType(type);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({ aircraftType: type }));
    } catch (e) {
      console.error('Fehler beim Speichern der Einstellungen:', e);
    }
  };

  // Auto-Focus & Auto-Loop Logik bei 4-stelliger HHMM Eingabe
  const handleStartTimeChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 4) {
      setStartTime(cleaned);
      if (cleaned.length === 4) {
        setTimeout(() => {
          endTimeInputRef.current?.focus();
        }, 50);
      }
    }
  };

  const handleEndTimeChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 4) {
      setEndTime(cleaned);
    }
  };

  // Hilfsfunktion: Wandelt HHMM in Minuten seit Mitternacht um
  const parseTimeToMinutes = (hhmm) => {
    if (hhmm.length !== 4) return null;
    const hours = parseInt(hhmm.substring(0, 2), 10);
    const minutes = parseInt(hhmm.substring(2, 4), 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  // Berechnungslogik gemäß den Vorgaben
  const calculateOvertime = () => {
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);

    if (startMin === null || endMin === null) {
      Alert.alert('Ungültige Eingabe', 'Bitte gib Start- und Endzeit im Format HHMM (z.B. 0800 oder 1630) an.');
      return;
    }

    let diffMinutes = endMin - startMin;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Tageswechsel (über Nacht)
    }

    let calculatedFactorPoints = 0;
    let intervalCount = 0;

    // Vorgabe: Berechnung beginnt ab der 31. Minute Differenz
    if (diffMinutes > 30) {
      // Bestimmung des ersten 15-Minuten-Intervall-Rasters (00, 15, 30, 45) nach der Startzeit + 30 Min
      const thresholdTime = startMin + 30;
      let nextIntervalMin = Math.ceil(thresholdTime / 15) * 15;

      // Zähle alle 15-Minuten-Rasterschritte bis zur Endzeit
      for (let t = nextIntervalMin; t <= startMin + diffMinutes; t += 15) {
        intervalCount++;
      }

      // Pro Intervall 6 Punkte (Multiplikator 6)
      calculatedFactorPoints = intervalCount * 6;
    }

    const newResult = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      startTime,
      endTime,
      diffMinutes,
      aircraftType,
      calculatedFactorPoints,
      intervalCount
    };

    setResult(newResult);
    const updatedHistory = [newResult, ...history];
    setHistory(updatedHistory);
    saveHistoryToStorage(updatedHistory);
  };

  const clearInputs = () => {
    setStartTime('');
    setEndTime('');
    setResult(null);
  };

  const deleteHistoryItem = (id) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    saveHistoryToStorage(updated);
  };

  const clearAllHistory = () => {
    Alert.alert(
      'Historie löschen',
      'Möchtest du wirklich alle Aufzeichnungen löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            setHistory([]);
            saveHistoryToStorage([]);
          }
        }
      ]
    );
  };

  // BACKUP & RESTORE LOGIK (Plattformübergreifend)
  const exportBackup = async () => {
    try {
      const historyData = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
      const settingsData = await AsyncStorage.getItem(STORAGE_KEY_SETTINGS);

      const backupObj = {
        app: 'uberstundenrechner',
        version: 1,
        timestamp: new Date().toISOString(),
        data: {
          history: historyData ? JSON.parse(historyData) : [],
          settings: settingsData ? JSON.parse(settingsData) : {}
        }
      };

      const jsonString = JSON.stringify(backupObj, null, 2);

      // Versuche nativen Export mit FileSystem
      if (FileSystem && FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}uberstunden_backup_${Date.now()}.json`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString);

        if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
          try {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
              const createdFile = await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                `uberstunden_backup_${Date.now()}.json`,
                'application/json'
              );
              await FileSystem.writeAsStringAsync(createdFile, jsonString);
              Alert.alert('Erfolg', 'Backup erfolgreich im gewählten Ordner gespeichert!');
              return;
            }
          } catch (safErr) {
            console.log('SAF Fallback triggered:', safErr);
          }
        }

        // Standard Teilen/Speichern Dialog
        await Share.share({
          title: 'Überstunden Rechner Backup',
          message: jsonString,
          url: Platform.OS === 'ios' ? fileUri : undefined
        });
        return;
      }

      // Modal Fallback
      setIsExporting(true);
      setBackupJsonText(jsonString);
      setBackupModalVisible(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Export Fehler', 'Backup konnte nicht exportiert werden.');
    }
  };

  const importBackup = async () => {
    try {
      if (DocumentPicker) {
        const pickerResult = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true
        });

        if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
          const fileUri = pickerResult.assets[0].uri;
          let content = '';

          if (FileSystem) {
            content = await FileSystem.readAsStringAsync(fileUri);
          }

          if (content) {
            processAndRestoreJson(content);
            return;
          }
        }
      }

      // Modal Fallback für manuelles Einfügen
      setIsExporting(false);
      setBackupJsonText('');
      setBackupModalVisible(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Import Fehler', 'Datei konnte nicht gelesen werden. Nutze den Text-Import.');
    }
  };

  const processAndRestoreJson = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.data) {
        throw new Error('Ungültiges Backup-Format');
      }

      Alert.alert(
        'Backup wiederherstellen',
        'Möchtest du die bestehenden Daten durch dieses Backup überschreiben?',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Wiederherstellen',
            style: 'destructive',
            onPress: async () => {
              if (parsed.data.history) {
                setHistory(parsed.data.history);
                await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(parsed.data.history));
              }
              if (parsed.data.settings) {
                if (parsed.data.settings.aircraftType) {
                  setAircraftType(parsed.data.settings.aircraftType);
                }
                await AsyncStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(parsed.data.settings));
              }
              setBackupModalVisible(false);
              Alert.alert('Erfolg', 'Daten wurden erfolgreich wiederhergestellt.');
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('Fehler', 'Das JSON-Format ist ungültig oder beschädigt.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        {/* HEADER / TITLE */}
        <View style={styles.header}>
          <Text style={styles.title}>OVERTIME // MATRIX</Text>
          <View style={styles.glowBar} />
          <Text style={styles.subtitle}>B747 / A340 / A360 & FLEET CALCULATION</Text>
        </View>

        {/* TYP SELEKTOR */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>FLUGZEUGTYP WÄHLEN</Text>
          <View style={styles.typeContainer}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                aircraftType === 'B747_A340' && styles.typeButtonActive
              ]}
              onPress={() => handleAircraftChange('B747_A340')}
            >
              <Text style={[styles.typeButtonText, aircraftType === 'B747_A340' && styles.typeButtonTextActive]}>
                B747 & A340/600
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                aircraftType === 'ALL_OTHERS' && styles.typeButtonActive
              ]}
              onPress={() => handleAircraftChange('ALL_OTHERS')}
            >
              <Text style={[styles.typeButtonText, aircraftType === 'ALL_OTHERS' && styles.typeButtonTextActive]}>
                Alle anderen
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* EINGABE ZEITEN */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>EINGABE ZEITFENSTER (HHMM)</Text>
          <View style={styles.inputRow}>
            
            <View style={styles.inputWrapper}>
              <Text style={styles.inputSubLabel}>STARTZEIT</Text>
              <TextInput
                style={styles.timeInput}
                value={startTime}
                onChangeText={handleStartTimeChange}
                placeholder="0800"
                placeholderTextColor="#3a4b6e"
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

            <View style={styles.inputSeparator}>
              <Text style={styles.separatorText}>→</Text>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputSubLabel}>ENDZEIT</Text>
              <TextInput
                ref={endTimeInputRef}
                style={styles.timeInput}
                value={endTime}
                onChangeText={handleEndTimeChange}
                placeholder="1645"
                placeholderTextColor="#3a4b6e"
                keyboardType="numeric"
                maxLength={4}
              />
            </View>

          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.calcButton} onPress={calculateOvertime}>
              <Text style={styles.calcButtonText}>BERECHNEN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearButton} onPress={clearInputs}>
              <Text style={styles.clearButtonText}>RESET</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ERGEBNIS ANZEIGE */}
        {result && (
          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.resultTitle}>BERECHNUNGSERGEBNIS</Text>
            
            <View style={styles.resultGrid}>
              <View style={styles.resultBox}>
                <Text style={styles.resultBoxValue}>
                  {result.startTime.replace(/(\d{2})(\d{2})/, '$1:$2')} - {result.endTime.replace(/(\d{2})(\d{2})/, '$1:$2')}
                </Text>
                <Text style={styles.resultBoxLabel}>Zeitfenster</Text>
              </View>

              <View style={styles.resultBox}>
                <Text style={styles.resultBoxValue}>{result.diffMinutes} Min.</Text>
                <Text style={styles.resultBoxLabel}>Gesamtdifferenz</Text>
              </View>
            </View>

            <View style={styles.resultHighlight}>
              <Text style={styles.resultHighlightLabel}>PUNKTE / ERGEBNIS (x6)</Text>
              <Text style={styles.resultHighlightValue}>+{result.calculatedFactorPoints}</Text>
              <Text style={styles.resultHighlightSub}>
                {result.intervalCount} Intervall(e) à 15 Min. ab 31. Minute
              </Text>
            </View>
          </View>
        )}

        {/* HISTORIE */}
        <View style={styles.card}>
          <View style={styles.historyHeader}>
            <Text style={styles.cardLabel}>VERLAUF / HISTORIE</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={clearAllHistory}>
                <Text style={styles.deleteLink}>Alle löschen</Text>
              </TouchableOpacity>
            )}
          </View>

          {history.length === 0 ? (
            <Text style={styles.emptyText}>Keine Aufzeichnungen vorhanden.</Text>
          ) : (
            history.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View>
                  <Text style={styles.historyMainText}>
                    {item.startTime.replace(/(\d{2})(\d{2})/, '$1:$2')} - {item.endTime.replace(/(\d{2})(\d{2})/, '$1:$2')} ({item.diffMinutes}m)
                  </Text>
                  <Text style={styles.historySubText}>
                    {item.date} • {item.aircraftType === 'B747_A340' ? 'B747 & A340/600' : 'Andere'}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyPoints}>+{item.calculatedFactorPoints}</Text>
                  <TouchableOpacity onPress={() => deleteHistoryItem(item.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* BACKUP & RESTORE BUTTONS */}
        <View style={styles.backupContainer}>
          <TouchableOpacity style={styles.backupBtn} onPress={exportBackup}>
            <Text style={styles.backupBtnText}>BACKUP EXPORT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backupBtn} onPress={importBackup}>
            <Text style={styles.backupBtnText}>BACKUP IMPORT</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* BACKUP / TEXT MODAL (FALLBACK) */}
      <Modal
        visible={backupModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBackupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isExporting ? 'BACKUP EXPORT (JSON)' : 'BACKUP IMPORT (JSON)'}
            </Text>
            <Text style={styles.modalSub}>
              {isExporting
                ? 'Kopiere den folgenden JSON-Code zum Sichern:'
                : 'Füge den gesicherten JSON-Code hier ein:'}
            </Text>

            <TextInput
              style={styles.modalInput}
              multiline={true}
              value={backupJsonText}
              onChangeText={setBackupJsonText}
              editable={!isExporting}
              placeholder='{"app": "uberstundenrechner", ...}'
              placeholderTextColor="#3a4b6e"
            />

            <View style={styles.modalActionRow}>
              {!isExporting && (
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={() => processAndRestoreJson(backupJsonText)}
                >
                  <Text style={styles.modalBtnText}>Wiederherstellen</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setBackupModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Schließen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// SCI-FI DASHBOARD / FUTURISTIC MINIMALISM STYLES
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  title: {
    color: '#00f2fe',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },
  glowBar: {
    width: 140,
    height: 3,
    backgroundColor: '#00f2fe',
    marginTop: 6,
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 5,
  },
  subtitle: {
    color: '#5c73a3',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: {
    color: '#00f2fe',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#0d1322',
    borderWidth: 1,
    borderColor: '#2d3b55',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    borderColor: '#00f2fe',
  },
  typeButtonText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
  },
  typeButtonTextActive: {
    color: '#00f2fe',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputWrapper: {
    flex: 1,
  },
  inputSubLabel: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  timeInput: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#2d3b55',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 10,
    letterSpacing: 2,
  },
  inputSeparator: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  separatorText: {
    color: '#00f2fe',
    fontSize: 20,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  calcButton: {
    flex: 3,
    backgroundColor: '#00f2fe',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#00f2fe',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  calcButtonText: {
    color: '#090d16',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1.5,
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 12,
  },
  resultCard: {
    borderColor: '#00f2fe',
    backgroundColor: '#0e1726',
  },
  resultTitle: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  resultGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  resultBox: {
    flex: 1,
    backgroundColor: '#090d16',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  resultBoxValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  resultBoxLabel: {
    color: '#475569',
    fontSize: 9,
    marginTop: 4,
    fontWeight: '700',
  },
  resultHighlight: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  resultHighlightLabel: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resultHighlightValue: {
    color: '#10b981',
    fontSize: 36,
    fontWeight: '900',
    marginVertical: 4,
  },
  resultHighlightSub: {
    color: '#64748b',
    fontSize: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteLink: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyText: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 10,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#090d16',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8,
  },
  historyMainText: {
    color: '#f8fafc',
    fontWeight: '800',
    fontSize: 13,
  },
  historySubText: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyPoints: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900',
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    color: '#64748b',
    fontSize: 14,
  },
  backupContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  backupBtn: {
    flex: 1,
    backgroundColor: '#0d1322',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backupBtnText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#00f2fe',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#00f2fe',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  modalSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#090d16',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 8,
    color: '#10b981',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    height: 180,
    padding: 10,
    textAlignVertical: 'top',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: '#00f2fe',
  },
  modalBtnSecondary: {
    backgroundColor: '#1e293b',
  },
  modalBtnText: {
    color: '#090d16',
    fontWeight: '900',
    fontSize: 12,
  },
});
