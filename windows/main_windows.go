//go:build windows

package main

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
	"github.com/jchv/go-webview2/webviewloader"
	"golang.org/x/sys/windows"
)

//go:embed app.html THIRD-PARTY-NOTICES.txt
var assets embed.FS

var (
	user32          = windows.NewLazySystemDLL("user32.dll")
	messageBox      = user32.NewProc("MessageBoxW")
	comdlg32        = windows.NewLazySystemDLL("comdlg32.dll")
	getSaveFileName = comdlg32.NewProc("GetSaveFileNameW")
	dialogError     = comdlg32.NewProc("CommDlgExtendedError")
)

func utf16(s string) *uint16 { p, _ := windows.UTF16PtrFromString(s); return p }
func alert(s string) {
	messageBox.Call(0, uintptr(unsafe.Pointer(utf16(s))), uintptr(unsafe.Pointer(utf16("EMK Easy"))), 0x10)
}

type openFileName struct {
	Size            uint32
	Owner           uintptr
	Instance        uintptr
	Filter          *uint16
	CustomFilter    *uint16
	MaxCustomFilter uint32
	FilterIndex     uint32
	File            *uint16
	MaxFile         uint32
	FileTitle       *uint16
	MaxFileTitle    uint32
	InitialDir      *uint16
	Title           *uint16
	Flags           uint32
	FileOffset      uint16
	FileExtension   uint16
	DefaultExt      *uint16
	CustomData      uintptr
	Hook            uintptr
	TemplateName    *uint16
	Reserved        uintptr
	ReservedWord    uint32
	FlagsEx         uint32
}

func saveDialog(owner uintptr) (string, error) {
	filename := make([]uint16, 32768)
	copy(filename, windows.StringToUTF16("EMK-Easy-NCN.zip"))
	// Construct a double-null-terminated filter.
	filter := []uint16{'Z', 'I', 'P', ' ', 'a', 'r', 'c', 'h', 'i', 'v', 'e', ' ', '(', '*', '.', 'z', 'i', 'p', ')', 0, '*', '.', 'z', 'i', 'p', 0, 0}
	dialog := openFileName{
		Size: uint32(unsafe.Sizeof(openFileName{})), Owner: owner,
		Filter: &filter[0], FilterIndex: 1, File: &filename[0], MaxFile: uint32(len(filename)),
		Title: utf16("บันทึกผลลัพธ์ ZIP"), DefaultExt: utf16("zip"),
		Flags: 0x00000002 | 0x00000800 | 0x00000008 | 0x00080000 | 0x00800000 | 0x00000004,
	}
	ok, _, _ := getSaveFileName.Call(uintptr(unsafe.Pointer(&dialog)))
	if ok == 0 {
		code, _, _ := dialogError.Call()
		if code != 0 {
			return "", fmt.Errorf("เปิดหน้าต่างบันทึกไม่สำเร็จ (0x%X)", code)
		}
		return "", nil
	}
	return windows.UTF16ToString(filename), nil
}

func main() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	version, err := webviewloader.GetInstalledVersion()
	if err != nil || version == "" {
		alert("กรุณาติดตั้ง Microsoft Edge WebView2 Runtime แล้วเปิด EMK Easy อีกครั้ง\n\nhttps://developer.microsoft.com/microsoft-edge/webview2/")
		return
	}
	cache, err := os.UserCacheDir()
	if err != nil {
		alert("ไม่พบโฟลเดอร์ข้อมูลผู้ใช้: " + err.Error())
		return
	}
	profile := filepath.Join(cache, "EMK Easy", "WebView2")
	if err = os.MkdirAll(profile, 0700); err != nil {
		alert("สร้างโฟลเดอร์โปรแกรมไม่สำเร็จ: " + err.Error())
		return
	}
	w := webview2.NewWithOptions(webview2.WebViewOptions{Debug: false, AutoFocus: true, DataPath: profile, WindowOptions: webview2.WindowOptions{Title: "EMK Easy v1.0.1", Width: 1080, Height: 820, Center: true}})
	if w == nil {
		alert("เปิดหน้าต่างโปรแกรมไม่สำเร็จ")
		return
	}
	defer w.Destroy()
	w.SetSize(740, 600, webview2.HintMin)
	if err = w.Bind("nativeSaveZip", func(encoded string) (string, error) {
		data, err := decodeZip(encoded)
		if err != nil {
			return "", err
		}
		path, err := saveDialog(uintptr(w.Window()))
		if err != nil || path == "" {
			return "", err
		}
		if err = writeAtomic(path, data); err != nil {
			return "", fmt.Errorf("บันทึกไฟล์ไม่สำเร็จ: %w", err)
		}
		return path, nil
	}); err != nil {
		alert("เตรียมระบบบันทึกไม่สำเร็จ: " + err.Error())
		return
	}
	html, err := assets.ReadFile("app.html")
	if err != nil {
		alert(err.Error())
		return
	}
	w.SetHtml(string(html))
	w.Run()
}
