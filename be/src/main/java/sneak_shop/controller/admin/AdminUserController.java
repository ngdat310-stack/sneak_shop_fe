package sneak_shop.controller.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import sneak_shop.common.exception.AppException;
import sneak_shop.common.exception.ErrorCode;
import sneak_shop.common.response.ApiResponse;
import sneak_shop.common.response.PageResponse;
import sneak_shop.entity.UserEntity;
import sneak_shop.enums.UserRole;
import sneak_shop.enums.UserStatus;
import sneak_shop.repository.UserRepository;
import sneak_shop.service.UsernameGenerator;

import java.time.Instant;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    record UserSummary(Integer id, String email, String username, String fullName, String phone,
                       String gender, String birthDate, String role, String status,
                       Instant createdAt, boolean locked, String lockReason, Instant lockedAt,
                       boolean enabled) {}

    record CreateRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 2, max = 100) String fullName,
            @NotBlank @Size(min = 6) String password,
            String phone,
            UserRole role
    ) {}

    record UpdateRequest(
            @NotBlank @Size(min = 2, max = 100) String fullName,
            String phone
    ) {}

    record LockRequest(
            @NotBlank @Size(min = 2, max = 500) String reason
    ) {}

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UsernameGenerator usernameGenerator;

    public AdminUserController(UserRepository userRepository, PasswordEncoder passwordEncoder, UsernameGenerator usernameGenerator) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.usernameGenerator = usernameGenerator;
    }

    @GetMapping
    public ApiResponse<PageResponse<UserSummary>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) UserRole role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        String kw = keyword != null ? keyword.toLowerCase() : null;
        var result = userRepository.search(kw, role,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ApiResponse.ok(PageResponse.from(result.map(this::toSummary)));
    }

    @GetMapping("/{id}")
    public ApiResponse<UserSummary> getOne(@PathVariable Integer id) {
        return ApiResponse.ok(toSummary(findUser(id)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserSummary> create(@Valid @RequestBody CreateRequest req) {
        if (userRepository.existsByEmail(req.email()))
            throw new AppException(ErrorCode.CONFLICT, "Email da duoc su dung");
        UserEntity user = UserEntity.builder()
                .email(req.email())
                .fullName(req.fullName())
                .username(usernameGenerator.generate(req.fullName(), req.email()))
                .password(passwordEncoder.encode(req.password()))
                .phone(req.phone())
                .role(req.role() != null ? req.role() : UserRole.user)
                .status(UserStatus.active)
                .build();
        return ApiResponse.ok("Tao tai khoan thanh cong", toSummary(userRepository.save(user)));
    }

    @PatchMapping("/{id}")
    public ApiResponse<UserSummary> update(@PathVariable Integer id,
                                           @Valid @RequestBody UpdateRequest req) {
        UserEntity user = findUser(id);
        user.setFullName(req.fullName());
        user.setPhone(req.phone());
        return ApiResponse.ok("Cap nhat thanh cong", toSummary(userRepository.save(user)));
    }

    @PatchMapping("/{id}/lock")
    public ApiResponse<UserSummary> lock(@PathVariable Integer id, @Valid @RequestBody LockRequest req) {
        UserEntity user = findUser(id);
        if (user.getDeletedAt() != null)
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tai khoan da bi khoa");
        user.setDeletedAt(Instant.now());
        user.setLockReason(req.reason());
        return ApiResponse.ok("Da khoa tai khoan", toSummary(userRepository.save(user)));
    }

    @PatchMapping("/{id}/unlock")
    public ApiResponse<UserSummary> unlock(@PathVariable Integer id) {
        UserEntity user = findUser(id);
        if (user.getDeletedAt() == null)
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tai khoan dang hoat dong");
        user.setDeletedAt(null);
        user.setLockReason(null);
        return ApiResponse.ok("Da mo khoa tai khoan", toSummary(userRepository.save(user)));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<UserSummary> delete(@PathVariable Integer id) {
        UserEntity user = findUser(id);
        if (user.getDeletedAt() != null && user.getStatus() == UserStatus.inactive && Boolean.FALSE.equals(user.getEnabled())) {
            throw new AppException(ErrorCode.INVALID_REQUEST, "Tai khoan da bi xoa");
        }
        user.setStatus(UserStatus.inactive);
        user.setEnabled(false);
        user.setDeletedAt(Instant.now());
        user.setLockReason("Da xoa tai khoan");
        return ApiResponse.ok("Da xoa tai khoan", toSummary(userRepository.save(user)));
    }

    private UserEntity findUser(Integer id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "User khong ton tai"));
    }

    private UserSummary toSummary(UserEntity u) {
        return new UserSummary(u.getId(), u.getEmail(), u.getUsername(), u.getFullName(), u.getPhone(),
                u.getGender() != null ? u.getGender().name() : null,
                u.getBirthDate() != null ? u.getBirthDate().toString() : null,
                u.getRole().name(), u.getStatus().name(), u.getCreatedAt(), u.getDeletedAt() != null,
                u.getLockReason(), u.getDeletedAt(), Boolean.TRUE.equals(u.getEnabled()));
    }
}
