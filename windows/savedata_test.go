package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func TestZipPayload(t *testing.T) {
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	f, _ := z.Create("NCN/Song/test.mid")
	f.Write([]byte("midi bytes"))
	z.Close()
	out, err := decodeZip(base64.StdEncoding.EncodeToString(b.Bytes()))
	if err != nil || !bytes.Equal(out, b.Bytes()) {
		t.Fatalf("ZIP payload changed: %v", err)
	}
	for _, v := range []string{"!", "", base64.StdEncoding.EncodeToString([]byte("not zip"))} {
		if _, err := decodeZip(v); err == nil {
			t.Fatal("invalid payload accepted")
		}
	}
}
func TestAtomicSave(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "เพลง.zip")
	if err := writeAtomic(p, []byte("first")); err != nil {
		t.Fatal(err)
	}
	if err := writeAtomic(p, []byte("replacement")); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(p)
	if string(b) != "replacement" {
		t.Fatal("wrong saved bytes")
	}
	files, _ := os.ReadDir(dir)
	if len(files) != 1 {
		t.Fatal("temporary file left behind")
	}
	if err := writeAtomic(filepath.Join(dir, "missing", "result.zip"), nil); err == nil {
		t.Fatal("missing directory accepted")
	}
}
