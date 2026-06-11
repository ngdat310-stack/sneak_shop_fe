package sneak_shop.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/public")
public class PublicUploadController {

    @Value("${app.upload.dir:uploads/images}")
    private String uploadDir;

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "File rong"));

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Chi chap nhan file anh"));
        }

        if (file.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest().body(Map.of("error", "File toi da 5MB"));
        }

        Path dir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(dir);

        String ext = "";
        String original = file.getOriginalFilename();
        if (original != null && original.contains("."))
            ext = original.substring(original.lastIndexOf("."));

        String filename = "contact_" + UUID.randomUUID() + ext;
        Path dest = dir.resolve(filename);
        java.nio.file.Files.copy(file.getInputStream(), dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

        return ResponseEntity.ok(Map.of("url", ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/images/")
                .path(filename)
                .toUriString()));
    }
}
