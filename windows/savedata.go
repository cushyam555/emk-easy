package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
)

const maxZipSize = 136 * 1024 * 1024

func decodeZip(encoded string) ([]byte, error) {
	if len(encoded) > base64.StdEncoding.EncodedLen(maxZipSize) {
		return nil, errors.New("ไฟล์ ZIP ใหญ่เกินไป")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, errors.New("ข้อมูลบันทึกไม่ถูกต้อง")
	}
	if len(data) > maxZipSize {
		return nil, errors.New("ไฟล์ ZIP ใหญ่เกินไป")
	}
	z, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil || len(z.File) == 0 {
		return nil, errors.New("ข้อมูล ZIP ไม่สมบูรณ์")
	}
	return data, nil
}

func writeAtomic(path string, data []byte) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".emk-easy-*.tmp")
	if err != nil {
		return err
	}
	temp := f.Name()
	defer os.Remove(temp)
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(temp, path)
}
