package sneak_shop.controller.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/images")
@PreAuthorize("hasRole('ADMIN') or hasRole('STAFF')")
public class AdminImageController {

    @Value("${app.upload.dir:uploads/images}")
    private String uploadDir;

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        String url = saveFile(file);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @PostMapping("/upload-multiple")
    public ResponseEntity<Map<String, List<String>>> uploadMultiple(@RequestParam("files") List<MultipartFile> files) throws IOException {
        List<String> urls = new ArrayList<>();
        for (MultipartFile file : files) {
            urls.add(saveFile(file));
        }
        return ResponseEntity.ok(Map.of("urls", urls));
    }

    private String saveFile(MultipartFile file) throws IOException {
        Path dir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(dir);

        String ext = "";
        String original = file.getOriginalFilename();
        if (original != null && original.contains(".")) {
            ext = original.substring(original.lastIndexOf("."));
        }
        String filename = UUID.randomUUID() + ext;
        Path dest = dir.resolve(filename);
        Files.copy(file.getInputStream(), dest, StandardCopyOption.REPLACE_EXISTING);
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/images/")
                .path(filename)
                .toUriString();
    }
}
