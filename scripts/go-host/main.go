package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	port := flag.String("port", "4173", "port to listen on")
	dir := flag.String("dir", "./build", "directory to serve")
	flag.Parse()

	root, err := filepath.Abs(*dir)
	if err != nil {
		log.Fatalf("invalid directory: %v", err)
	}

	if info, statErr := os.Stat(root); statErr != nil || !info.IsDir() {
		log.Fatalf("build directory does not exist: %s", root)
	}

	indexPath := filepath.Join(root, "index.html")
	if _, statErr := os.Stat(indexPath); statErr != nil {
		log.Fatalf("index.html not found in build directory: %s", indexPath)
	}

	fileServer := http.FileServer(http.Dir(root))

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
		requested := filepath.Join(root, cleanPath)
		if info, statErr := os.Stat(requested); statErr == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		if strings.HasPrefix(r.URL.Path, "/assets") || strings.HasPrefix(r.URL.Path, "/_app") {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, indexPath)
	})

	addr := ":" + *port
	log.Printf("Serving %s on http://localhost%s", root, addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
